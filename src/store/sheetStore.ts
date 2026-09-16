import { useEffect, useMemo } from "react";
import { create, useStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { temporal } from "zundo";
import {
  addColumn,
  addRow,
  applyFormula,
  ApplyScope,
  CellAlign,
  CellFormat,
  CfStyle,
  CfRule,
  CfTest,
  ChartAnchor,
  ChartKind,
  ChartSpec,
  clearRange,
  cloneSheet,
  ClipboardBlock,
  computeSheet,
  copyRange,
  createEmptySheet,
  deleteColumn,
  deleteRow,
  detectSortRange,
  getCellFormat,
  insertColumnBefore,
  insertRowBefore,
  NumberFormat,
  parseTsv,
  pasteClipboardBlock,
  pastePlainTextBlock,
  setCellRaw,
  sheetFromGrid,
  setComment,
  setRangeFormat,
  SheetModel,
  sortRange,
  toTsv,
} from "@/lib/sheet";
import { autoChartAnchor } from "@/lib/gridGeometry";
import { cellRef, rangeRefString } from "@/lib/formulaEngine/address";
import { FormulaValue } from "@/lib/formulaEngine/types";
import { PivotConfig, PivotSource, buildPivot, hashValues } from "@/lib/pivot";
// ExcelJS (~400KB) and jsPDF + autoTable are loaded on demand, not with the store.
//
// They were plain imports, which put both libraries in the app's first chunk — and because the
// landing page links to /app, Next prefetched that chunk, so every visitor who only read the
// landing page still downloaded 433KB of spreadsheet-writing and PDF-writing code they never ran.
// Each of the three actions below is already async and already raises a busy flag, so awaiting the
// import costs nothing a user can perceive: the work only starts when they click Import or Export.
import { FormulaDef } from "@/lib/formulaCatalog";
import { addMerge, rangeHasMerge, removeMerges } from "@/lib/sheetMerges";
import { isSingleCell, singleCellSelection, SelectionRect } from "@/types/sheet-ui";
import { getMessages } from "@/i18n";
import { TableData } from "@/lib/dataSources/types";
import { boundCellsOf, clearLiveBlock, LiveBlock, liveBlockCells, writeLiveBlock } from "@/lib/liveBlocks";
import { isTemplateLocked, rangeHasLockedCells } from "@/lib/sheetTemplate";

export type SidebarMode = "palette" | "ai" | "data" | "cf" | "chart" | "pivot" | "cloud" | "none";
export type { ApplyScope };

export interface PendingFormula {
  def: FormulaDef;
  anchorRow: number;
  anchorCol: number;
  values: Record<string, string>;
  pickingKey: string | null;
  scope: ApplyScope;
}

export interface SheetTab {
  id: string;
  name: string;
  sheet: SheetModel;
  /** Regions fed by live data sources. Optional so tabs autosaved before this existed still load. */
  liveBlocks?: LiveBlock[];
}

/**
 * The table a first-time visitor lands on.
 *
 * Nine rows across three categories rather than the three rows it started with, because the sheet
 * is the demo: someone opening this to judge it has to be able to press Pivot, Chart, sort or
 * filter and get an answer worth looking at. Three rows grouped into two categories technically
 * proves a pivot works and shows nothing anyone would care about.
 *
 * Every total is a formula, not a number, so the first thing anyone does — change a price — visibly
 * moves the column and the grand total. That is the whole pitch in one edit.
 */
function seedSample(): SheetModel {
  const sheet = createEmptySheet();
  const header = ["สินค้า", "หมวดหมู่", "ราคา", "จำนวน", "รวม"];
  header.forEach((h, c) => (sheet.cells[0][c] = h));
  const rows: [string, string, number, number][] = [
    ["กาแฟลาเต้", "เครื่องดื่ม", 65, 18],
    ["ชาไทย", "เครื่องดื่ม", 45, 24],
    ["น้ำส้มคั้น", "เครื่องดื่ม", 55, 9],
    ["ครัวซองต์", "เบเกอรี่", 55, 12],
    ["ขนมปังไส้ทะลัก", "เบเกอรี่", 35, 20],
    ["เค้กช็อกโกแลต", "เบเกอรี่", 85, 6],
    ["ข้าวผัดกระเพรา", "อาหารจานเดียว", 60, 15],
    ["ผัดไทยกุ้งสด", "อาหารจานเดียว", 80, 11],
    ["ข้าวมันไก่", "อาหารจานเดียว", 50, 22],
  ];
  rows.forEach((row, r) => {
    sheet.cells[r + 1][0] = row[0];
    sheet.cells[r + 1][1] = row[1];
    sheet.cells[r + 1][2] = String(row[2]);
    sheet.cells[r + 1][3] = String(row[3]);
    sheet.cells[r + 1][4] = `=C${r + 2}*D${r + 2}`;
  });
  const totalRow = rows.length + 2;
  sheet.cells[totalRow][3] = "รวมทั้งหมด";
  sheet.cells[totalRow][4] = `=SUM(E2:E${rows.length + 1})`;
  return sheet;
}

let idCounter = 0;
function genId(): string {
  idCounter += 1;
  return `sheet-${Date.now().toString(36)}-${idCounter}`;
}

/** "Pivot", then "Pivot 2", "Pivot 3"… so repeated pivots don't all answer to the same name. */
function nextPivotName(tabs: SheetTab[], base: string): string {
  const taken = new Set(tabs.map((t) => t.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

function newTab(name: string, sheet: SheetModel = createEmptySheet()): SheetTab {
  return { id: genId(), name, sheet };
}

function selectionToAddress(sel: SelectionRect): string {
  return isSingleCell(sel)
    ? cellRef(sel.anchorRow, sel.anchorCol)
    : rangeRefString(sel.startRow, sel.startCol, sel.endRow, sel.endCol);
}

interface ClipboardState extends ClipboardBlock {
  cut: boolean;
}

interface SheetState {
  sheets: SheetTab[];
  activeSheetId: string;
  /** Kept separate from `sheets` (not tracked for undo/autosave) since navigating within a
   *  sheet isn't content that should be undoable or restored on reload. Falls back to (0,0)
   *  for a sheet with no entry yet via `activeSelectionOf`. */
  selectionBySheetId: Record<string, SelectionRect>;
  /** Per-sheet, per-column allow-list of values to show (a column with no entry is unfiltered).
   *  Like `selectionBySheetId`, kept out of `sheets` — a view filter isn't undoable content. */
  filtersBySheetId: Record<string, Record<number, string[]>>;
  pending: PendingFormula | null;
  sidebarMode: SidebarMode;
  /** Whether the formatting row is showing. UI-only: outside both the undo and autosave slices,
   *  since folding a toolbar away isn't sheet content. */
  formatBarOpen: boolean;
  busy: string | null;
  clipboard: ClipboardState | null;
  /** Which source the "what do you want to insert" dialog is open for, and whether it's changing
   *  an existing block rather than adding one. Opened from the panel and from a block's toolbar. */
  dataPicker: { sourceId: string; replacingBlockId?: string } | null;

  setActiveSheet: (id: string) => void;
  addSheet: () => void;
  /** Throws away the sample workbook and starts from one empty sheet. Only reachable while the
   *  sample is untouched, so there is nothing of the user's to lose. */
  startBlank: () => void;
  renameSheet: (id: string, name: string) => void;
  deleteSheet: (id: string) => void;

  setCellRaw: (row: number, col: number, raw: string) => void;
  addRow: () => void;
  addColumn: () => void;
  deleteSelectedRow: () => void;
  deleteSelectedColumn: () => void;
  insertRowAtSelection: () => void;
  insertColumnAtSelection: () => void;
  /** Drops an imported template's protection, making every cell editable. Undoable, since the
   *  template lives inside `sheets`. */
  unlockTemplate: () => void;
  setSelection: (sel: SelectionRect) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  toggleFormatBar: () => void;
  toggleSidebar: (mode: Exclude<SidebarMode, "none">) => void;

  /** Drops a live block at the active sheet's selection anchor and fills it right away if the
   *  source's data is already cached. */
  addLiveBlock: (block: Omit<LiveBlock, "id" | "rows" | "cols">, table: TableData | undefined) => void;
  /** Swaps what a placed block shows (table ⇄ value, or a different column) in one undoable step. */
  replaceLiveBlock: (blockId: string, block: Omit<LiveBlock, "id" | "rows" | "cols">, table: TableData | undefined) => void;
  removeLiveBlock: (blockId: string) => void;
  removeLiveBlocksForSource: (sourceId: string) => void;
  openDataPicker: (picker: { sourceId: string; replacingBlockId?: string }) => void;
  closeDataPicker: () => void;
  /** Rewrites every block bound to `sourceId`, on every sheet, with fresh data. Not undoable —
   *  a refresh isn't a user edit. */
  applyLiveData: (sourceId: string, table: TableData) => void;

  clearSelection: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteAtSelection: (externalText?: string) => void;
  clearClipboard: () => void;

  sortSelection: (ascending: boolean) => void;
  setColumnFilter: (col: number, values: string[]) => void;
  clearColumnFilter: (col: number) => void;
  clearAllFilters: () => void;

  /** Summarises the selected range onto a brand-new sheet. Returns false when the selection is
   *  too small to pivot, so the panel can say so instead of silently doing nothing. */
  buildPivotSheet: (config: PivotConfig) => boolean;
  /** Rebuilds the active pivot sheet from its source. False when it has no source, or the source is gone. */
  refreshPivot: () => boolean;
  addChart: (kind: ChartKind) => void;
  removeChart: (id: string) => void;
  setChartKind: (id: string, kind: ChartKind) => void;
  moveChart: (id: string, anchor: ChartAnchor) => void;
  setPieSeries: (id: string, seriesIndex: number) => void;
  setCellComment: (row: number, col: number, text: string) => void;

  addConditionalRule: (test: CfTest, style?: CfStyle) => void;
  removeConditionalRule: (id: string) => void;
  clearConditionalRules: () => void;

  toggleBold: () => void;
  setAlign: (align: CellAlign) => void;
  setTextColor: (color: string) => void;
  setNumberFormat: (fmt: NumberFormat) => void;
  /** Joins the selection into one cell, or splits any merge it touches. */
  toggleMerge: () => void;

  openFormulaPanel: (def: FormulaDef, anchorRow: number, anchorCol: number) => void;
  updatePending: (pending: PendingFormula) => void;
  insertPending: () => void;
  cancelPending: () => void;

  insertAIFormula: (formula: string) => void;

  importFromFile: (file: File) => Promise<void>;
  replaceWorkbook: (sheets: SheetTab[]) => void;
  exportXlsx: () => Promise<void>;
  exportPdf: () => Promise<void>;
  exportCsv: () => Promise<void>;
}

/**
 * Builds the sheet a pivot produces, and stamps it with where it came from.
 *
 * Shared by the build button and the refresh button so that a refreshed pivot is laid out by exactly
 * the same code as the original — the failure mode otherwise is two renderers that drift apart and a
 * refresh that quietly changes the shape of the answer.
 *
 * Returns null when the range can't produce a pivot: the header row is the range's first row, so
 * there has to be at least one row of data under it, and grouping has to yield something.
 */
function renderPivotSheet(
  sourceSheet: SheetModel,
  range: PivotSource["range"],
  config: PivotConfig,
  sourceSheetId: string
): SheetModel | null {
  if (range.endRow <= range.startRow) return null;
  const computed = computeSheet(sourceSheet);

  const rows: FormulaValue[][] = [];
  for (let r = range.startRow; r <= range.endRow; r++) {
    const row: FormulaValue[] = [];
    for (let c = range.startCol; c <= range.endCol; c++) row.push(computed.values[r]?.[c] ?? null);
    rows.push(row);
  }

  const m = getMessages();
  const result = buildPivot(rows, config, {
    blank: m.pivot.blank,
    grandTotal: m.pivot.grandTotal,
    valueHeading: (agg, field) => m.pivot.valueHeading(m.pivot.aggNames[agg], field),
  });
  if (result.header.length === 0 || result.rows.length === 0) return null;

  const out = createEmptySheet();
  const lines = [result.header, ...result.rows, ...(result.totalRow ? [result.totalRow] : [])];
  lines.forEach((line, r) => {
    line.forEach((cell, c) => {
      if (r < out.rows && c < out.cols) out.cells[r][c] = cell === null ? "" : String(cell);
    });
  });
  // The header and the closing total are the two rows a reader scans for, so they are bold rather
  // than left to be picked out of a wall of numbers.
  for (let c = 0; c < result.header.length && c < out.cols; c++) {
    out.formats[0][c] = { bold: true };
    const last = lines.length - 1;
    if (result.totalRow && last < out.rows) out.formats[last][c] = { bold: true };
  }

  out.pivot = { sheetId: sourceSheetId, range, config, hash: hashValues(rows) };
  return out;
}

function activeTab(s: SheetState): SheetTab {
  return s.sheets.find((t) => t.id === s.activeSheetId) ?? s.sheets[0];
}

// A stable reference for "no selection recorded yet" — used as a Zustand selector fallback,
// where a freshly-allocated object every call would break snapshot-stability (the same bug
// fixed for useAnchorFormat's EMPTY_FORMAT below) and cause an infinite render loop.
const DEFAULT_SELECTION: SelectionRect = singleCellSelection(0, 0);

function activeSelectionOf(s: SheetState): SelectionRect {
  return s.selectionBySheetId[s.activeSheetId] ?? DEFAULT_SELECTION;
}

/** Replaces the active tab's sheet with whatever `fn` returns, leaving every other tab (and
 *  its name/id) untouched. Every action that edits cell content goes through this instead of
 *  a top-level `sheet` field, since edits always target "whichever tab is open right now". */
function withActiveSheet(s: SheetState, fn: (tab: SheetTab) => SheetModel): SheetTab[] {
  return s.sheets.map((tab) => (tab.id === s.activeSheetId ? { ...tab, sheet: fn(tab) } : tab));
}

/** The shape behind almost every action that edits cell content: read the active sheet and its
 *  selection, compute the next sheet, write it back. Collapses what would otherwise be a
 *  repeated `const { sheet } = activeTab(s); const selection = activeSelectionOf(s); ...
 *  withActiveSheet(s, () => next)` in each action to a single call. */
function updateActiveSheet(s: SheetState, fn: (sheet: SheetModel, selection: SelectionRect) => SheetModel): SheetTab[] {
  const { sheet } = activeTab(s);
  const selection = activeSelectionOf(s);
  return withActiveSheet(s, () => fn(sheet, selection));
}

/** Clamps a single-cell selection into a sheet's (possibly now-smaller) bounds — used after
 *  deleting the row/column the selection was on. */
function clampSelectionToBounds(sheet: SheetModel, selection: SelectionRect): SelectionRect {
  return singleCellSelection(Math.min(selection.anchorRow, sheet.rows - 1), Math.min(selection.anchorCol, sheet.cols - 1));
}

/** A template exists to stop the form being broken by accident, so operations that would write
 *  over its fixed cells are refused rather than partially applied — and the user is told why,
 *  since silently doing nothing reads as the app being broken. */
function refusedByTemplate(sheet: SheetModel, startRow: number, startCol: number, endRow: number, endCol: number): boolean {
  if (!rangeHasLockedCells(sheet.template, startRow, startCol, endRow, endCol)) return false;
  alert(getMessages().template.lockedCell);
  return true;
}

function refusedStructuralChange(sheet: SheetModel): boolean {
  if (!sheet.template) return false;
  alert(getMessages().template.structureLocked);
  return true;
}

function applySelectionFormat(sheet: SheetModel, selection: SelectionRect, patch: Partial<CellFormat>): SheetModel {
  return setRangeFormat(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol, patch);
}

/** Only the sheet tabs' content is tracked for undo/redo — switching tabs isn't something
 *  users expect Ctrl+Z to step through. */
type TemporalSlice = Pick<SheetState, "sheets">;

/** Autosaved to localStorage: the tabs' content plus which one was active, so reloading lands
 *  back on the same tab. Other UI-only state (an open formula panel, which sidebar is open)
 *  resets on reload. */
type PersistedSlice = Pick<SheetState, "sheets" | "activeSheetId">;

const initialTab = newTab("Sheet1", seedSample());

/**
 * Is the workbook still exactly what the app opened with — the sample, untouched?
 *
 * Object identity, not a content comparison. Every action here replaces the sheet immutably, so
 * anything a person does — typing, formatting, a chart, a pivot, an import, rehydrating their own
 * saved work from localStorage — produces a different object. Comparing content would miss all of
 * those that leave the cells alone, and "start from a blank sheet" would then quietly throw away a
 * chart somebody had just made.
 */
const INITIAL_SHEET = initialTab.sheet;
export function selectShowingSample(s: SheetState): boolean {
  return s.sheets.length === 1 && s.sheets[0].sheet === INITIAL_SHEET;
}

export const useSheetStore = create<SheetState>()(
  persist(
    temporal(
      (set, get) => ({
        sheets: [initialTab],
        activeSheetId: initialTab.id,
        selectionBySheetId: {},
        filtersBySheetId: {},
        pending: null,
        sidebarMode: "palette",
        formatBarOpen: true,
        busy: null,
        clipboard: null,
        dataPicker: null,

        openDataPicker: (picker) => set({ dataPicker: picker }),
        closeDataPicker: () => set({ dataPicker: null }),

        setActiveSheet: (id) => set({ activeSheetId: id }),

        addSheet: () => {
          const s = get();
          const tab = newTab(`Sheet${s.sheets.length + 1}`);
          set({ sheets: [...s.sheets, tab], activeSheetId: tab.id });
        },

        startBlank: () => {
          const tab = newTab("Sheet1");
          set({ sheets: [tab], activeSheetId: tab.id });
        },

        renameSheet: (id, name) => {
          const trimmed = name.trim();
          if (!trimmed) return;
          set((s) => ({ sheets: s.sheets.map((t) => (t.id === id ? { ...t, name: trimmed } : t)) }));
        },

        deleteSheet: (id) => {
          const s = get();
          if (s.sheets.length <= 1) return;
          const index = s.sheets.findIndex((t) => t.id === id);
          if (index === -1) return;
          const sheets = s.sheets.filter((t) => t.id !== id);
          const activeSheetId = s.activeSheetId === id ? sheets[Math.max(0, index - 1)].id : s.activeSheetId;
          set({ sheets, activeSheetId });
        },

        setCellRaw: (row, col, raw) =>
          set((s) => {
            // Covers the formula bar as well as the grid, so there's one place a locked cell
            // can't be written rather than a guard per entry point.
            if (isTemplateLocked(activeTab(s).sheet.template, row, col)) return {};
            return { sheets: withActiveSheet(s, (tab) => setCellRaw(tab.sheet, row, col, raw)) };
          }),
        addRow: () =>
          set((s) => (refusedStructuralChange(activeTab(s).sheet) ? {} : { sheets: withActiveSheet(s, (tab) => addRow(tab.sheet)) })),
        addColumn: () =>
          set((s) => (refusedStructuralChange(activeTab(s).sheet) ? {} : { sheets: withActiveSheet(s, (tab) => addColumn(tab.sheet)) })),

        unlockTemplate: () =>
          set((s) => ({
            sheets: withActiveSheet(s, (tab) => {
              if (!tab.sheet.template) return tab.sheet;
              const next = { ...tab.sheet };
              delete next.template;
              return next;
            }),
          })),

        deleteSelectedRow: () =>
          set((s) => {
            const { sheet } = activeTab(s);
            if (refusedStructuralChange(sheet)) return {};
            const selection = activeSelectionOf(s);
            const next = deleteRow(sheet, selection.anchorRow);
            return {
              sheets: withActiveSheet(s, () => next),
              selectionBySheetId: { ...s.selectionBySheetId, [s.activeSheetId]: clampSelectionToBounds(next, selection) },
            };
          }),

        deleteSelectedColumn: () =>
          set((s) => {
            const { sheet } = activeTab(s);
            if (refusedStructuralChange(sheet)) return {};
            const selection = activeSelectionOf(s);
            const next = deleteColumn(sheet, selection.anchorCol);
            return {
              sheets: withActiveSheet(s, () => next),
              selectionBySheetId: { ...s.selectionBySheetId, [s.activeSheetId]: clampSelectionToBounds(next, selection) },
            };
          }),

        insertRowAtSelection: () =>
          set((s) =>
            refusedStructuralChange(activeTab(s).sheet)
              ? {}
              : { sheets: updateActiveSheet(s, (sheet, selection) => insertRowBefore(sheet, selection.anchorRow)) }
          ),

        insertColumnAtSelection: () =>
          set((s) =>
            refusedStructuralChange(activeTab(s).sheet)
              ? {}
              : { sheets: updateActiveSheet(s, (sheet, selection) => insertColumnBefore(sheet, selection.anchorCol)) }
          ),

        clearSelection: () =>
          set((s) => {
            const sel = activeSelectionOf(s);
            if (refusedByTemplate(activeTab(s).sheet, sel.startRow, sel.startCol, sel.endRow, sel.endCol)) return {};
            return {
              sheets: updateActiveSheet(s, (sheet, selection) =>
                clearRange(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol)
              ),
            };
          }),

        copySelection: () => {
          const s = get();
          const { sheet } = activeTab(s);
          const selection = activeSelectionOf(s);
          const block = copyRange(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol);
          set({ clipboard: { ...block, cut: false } });
          navigator.clipboard?.writeText(toTsv(block)).catch(() => {});
        },

        cutSelection: () => {
          const s = get();
          const { sheet } = activeTab(s);
          const selection = activeSelectionOf(s);
          const block = copyRange(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol);
          set({ clipboard: { ...block, cut: true } });
          navigator.clipboard?.writeText(toTsv(block)).catch(() => {});
        },

        pasteAtSelection: (externalText) =>
          set((s) => {
            const { sheet } = activeTab(s);
            const selection = activeSelectionOf(s);
            if (sheet.template) {
              // Size the guard to what would actually be written, not just the selected cell.
              const height = s.clipboard?.rows.length ?? parseTsv(externalText ?? "").length;
              const width = s.clipboard?.rows[0]?.length ?? parseTsv(externalText ?? "")[0]?.length ?? 1;
              const endRow = selection.anchorRow + Math.max(0, height - 1);
              const endCol = selection.anchorCol + Math.max(0, width - 1);
              if (refusedByTemplate(sheet, selection.anchorRow, selection.anchorCol, endRow, endCol)) return {};
            }
            const { clipboard } = s;
            const targetRow = selection.anchorRow;
            const targetCol = selection.anchorCol;
            if (clipboard) {
              let next = pasteClipboardBlock(sheet, clipboard, targetRow, targetCol);
              let clearedClipboard: ClipboardState | null = clipboard;
              if (clipboard.cut) {
                const height = clipboard.rows.length;
                const width = clipboard.rows[0]?.length ?? 0;
                const srcEndRow = clipboard.startRow + height - 1;
                const srcEndCol = clipboard.startCol + width - 1;
                const destOverlapsSource =
                  targetRow <= srcEndRow &&
                  targetRow + height - 1 >= clipboard.startRow &&
                  targetCol <= srcEndCol &&
                  targetCol + width - 1 >= clipboard.startCol;
                // Moving to a spot that overlaps the original block would otherwise wipe out
                // the very cells pasteClipboardBlock just wrote there.
                if (!destOverlapsSource) {
                  next = clearRange(next, clipboard.startRow, clipboard.startCol, srcEndRow, srcEndCol);
                }
                clearedClipboard = null;
              }
              return { sheets: withActiveSheet(s, () => next), clipboard: clearedClipboard };
            }
            if (externalText) {
              const rows = parseTsv(externalText);
              if (rows.length > 0) {
                const next = pastePlainTextBlock(sheet, rows, targetRow, targetCol);
                return { sheets: withActiveSheet(s, () => next) };
              }
            }
            return {};
          }),

        clearClipboard: () => set({ clipboard: null }),

        sortSelection: (ascending) =>
          set((s) => {
            if (refusedStructuralChange(activeTab(s).sheet)) return {};
            return {
            sheets: updateActiveSheet(s, (sheet, selection) => {
              const computed = computeSheet(sheet);
              const range = detectSortRange(sheet, computed, selection, selection.anchorRow, selection.anchorCol);
              return sortRange(sheet, computed, range, selection.anchorCol, ascending);
            }),
            };
          }),

        setColumnFilter: (col, values) =>
          set((s) => ({
            filtersBySheetId: {
              ...s.filtersBySheetId,
              [s.activeSheetId]: { ...s.filtersBySheetId[s.activeSheetId], [col]: values },
            },
          })),

        clearColumnFilter: (col) =>
          set((s) => {
            const current = { ...s.filtersBySheetId[s.activeSheetId] };
            delete current[col];
            return { filtersBySheetId: { ...s.filtersBySheetId, [s.activeSheetId]: current } };
          }),

        clearAllFilters: () =>
          set((s) => ({ filtersBySheetId: { ...s.filtersBySheetId, [s.activeSheetId]: {} } })),

        toggleBold: () =>
          set((s) => ({
            sheets: updateActiveSheet(s, (sheet, selection) => {
              const anchorBold = getCellFormat(sheet, selection.anchorRow, selection.anchorCol).bold;
              return applySelectionFormat(sheet, selection, { bold: !anchorBold });
            }),
          })),

        setAlign: (align) =>
          set((s) => ({ sheets: updateActiveSheet(s, (sheet, selection) => applySelectionFormat(sheet, selection, { align })) })),

        /**
         * Writes a pivot of the current selection onto a new sheet.
         *
         * A new sheet rather than an overlay on this one: the result is an ordinary grid of values
         * that can be sorted, charted and exported like anything else, and dropping it beside the
         * source would overwrite whatever was already there. It is a snapshot, not a live object —
         * rebuild it when the numbers move, which is what the panel's button is for.
         */
        buildPivotSheet: (config) => {
          const s = get();
          const source = activeTab(s);
          const selection = activeSelectionOf(s);
          const range = {
            startRow: selection.startRow,
            startCol: selection.startCol,
            endRow: selection.endRow,
            endCol: selection.endCol,
          };
          const out = renderPivotSheet(source.sheet, range, config, source.id);
          if (!out) return false;

          const m = getMessages();
          const tab = newTab(nextPivotName(s.sheets, m.pivot.sheetName), out);
          set({ sheets: [...s.sheets, tab], activeSheetId: tab.id, sidebarMode: "none" });
          return true;
        },

        /**
         * Asks the pivot's question again, against the source as it is now.
         *
         * In place, on the same tab, keeping its name and position — the point is that this is the
         * same pivot, not a second one. Anything typed into the pivot sheet is overwritten, which is
         * why nothing refreshes on its own and the button only appears once the source has moved.
         */
        refreshPivot: () => {
          const s = get();
          const target = activeTab(s);
          const spec = target.sheet.pivot;
          if (!spec) return false;
          const source = s.sheets.find((t) => t.id === spec.sheetId);
          if (!source) return false;

          const out = renderPivotSheet(source.sheet, spec.range, spec.config, spec.sheetId);
          if (!out) return false;
          set({ sheets: s.sheets.map((t) => (t.id === target.id ? { ...t, sheet: out } : t)) });
          return true;
        },

        // A chart reads whatever is selected when it's made, like Excel's "insert chart".
        addChart: (kind) =>
          set((s) => ({
            sheets: updateActiveSheet(s, (sheet, selection) => {
              const chart: ChartSpec = {
                id: `chart-${Date.now().toString(36)}-${idCounter++}`,
                kind,
                range: {
                  startRow: selection.startRow,
                  startCol: selection.startCol,
                  endRow: selection.endRow,
                  endCol: selection.endCol,
                },
                anchor: autoChartAnchor(sheet, selection),
              };
              return { ...cloneSheet(sheet), charts: [...(sheet.charts ?? []), chart] };
            }),
          })),

        removeChart: (id) =>
          set((s) => ({
            sheets: updateActiveSheet(s, (sheet) => {
              const kept = (sheet.charts ?? []).filter((c) => c.id !== id);
              return { ...cloneSheet(sheet), charts: kept.length > 0 ? kept : undefined };
            }),
          })),

        setChartKind: (id, kind) =>
          set((s) => ({
            sheets: updateActiveSheet(s, (sheet) => ({
              ...cloneSheet(sheet),
              charts: (sheet.charts ?? []).map((c) => (c.id === id ? { ...c, kind } : c)),
            })),
          })),

        // Written once when a drag ends, never while it runs: every set() here is an undo step,
        // and a chart dragged across the sheet would otherwise bury the user's last real edit
        // under a hundred of them.
        moveChart: (id, anchor) =>
          set((s) => ({
            sheets: updateActiveSheet(s, (sheet) => ({
              ...cloneSheet(sheet),
              // The old pixel `frame` goes with the write rather than lingering beside the anchor
              // as a second, stale answer to the same question.
              charts: (sheet.charts ?? []).map((c) => (c.id === id ? { ...c, anchor, frame: undefined } : c)),
            })),
          })),

        setCellComment: (row, col, text) =>
          set((s) => ({
            sheets: updateActiveSheet(s, (sheet) => ({
              ...cloneSheet(sheet),
              comments: setComment(sheet.comments, row, col, text),
            })),
          })),

        setPieSeries: (id, seriesIndex) =>
          set((s) => ({
            sheets: updateActiveSheet(s, (sheet) => ({
              ...cloneSheet(sheet),
              charts: (sheet.charts ?? []).map((c) => (c.id === id ? { ...c, seriesIndex } : c)),
            })),
          })),

        // A rule is written for whatever is selected when it's created, the way Excel's ribbon
        // works — the selection is the question the user is already looking at.
        addConditionalRule: (test, style) =>
          set((s) => ({
            sheets: updateActiveSheet(s, (sheet, selection) => {
              const rule: CfRule = {
                id: `cf-${Date.now().toString(36)}-${idCounter++}`,
                range: {
                  startRow: selection.startRow,
                  startCol: selection.startCol,
                  endRow: selection.endRow,
                  endCol: selection.endCol,
                },
                test,
                style,
              };
              return { ...cloneSheet(sheet), conditionalRules: [...(sheet.conditionalRules ?? []), rule] };
            }),
          })),

        removeConditionalRule: (id) =>
          set((s) => ({
            sheets: updateActiveSheet(s, (sheet) => {
              const kept = (sheet.conditionalRules ?? []).filter((r) => r.id !== id);
              return { ...cloneSheet(sheet), conditionalRules: kept.length > 0 ? kept : undefined };
            }),
          })),

        clearConditionalRules: () =>
          set((s) => ({ sheets: updateActiveSheet(s, (sheet) => ({ ...cloneSheet(sheet), conditionalRules: undefined })) })),

        setTextColor: (color) =>
          set((s) => ({ sheets: updateActiveSheet(s, (sheet, selection) => applySelectionFormat(sheet, selection, { color })) })),

        setNumberFormat: (numberFormat) =>
          set((s) => ({
            sheets: updateActiveSheet(s, (sheet, selection) => applySelectionFormat(sheet, selection, { numberFormat })),
          })),

        /**
         * One button for both directions, because they are the same thought: a selection that
         * touches a merge splits it, and one that doesn't joins it. Two buttons would mean one of
         * them is always the wrong one to press.
         *
         * Joining keeps the top-left cell and blanks the rest — the only destructive thing here,
         * which is why the button asks first when there is actually something to lose.
         */
        toggleMerge: () =>
          set((s) => ({
            sheets: updateActiveSheet(s, (sheet, selection) => {
              const range = {
                startRow: selection.startRow,
                startCol: selection.startCol,
                endRow: selection.endRow,
                endCol: selection.endCol,
              };
              if (rangeHasMerge(sheet.merges, range)) {
                return { ...cloneSheet(sheet), merges: removeMerges(sheet.merges, range) };
              }
              const result = addMerge(sheet.merges, range);
              if (!result) return sheet;
              const next = cloneSheet(sheet);
              for (const [r, c] of result.cleared) next.cells[r][c] = "";
              next.merges = result.merges;
              return next;
            }),
          })),

        setSelection: (sel) =>
          set((s) => {
            const selectionBySheetId = { ...s.selectionBySheetId, [s.activeSheetId]: sel };
            if (!s.pending?.pickingKey) {
              return { selectionBySheetId };
            }
            const addr = selectionToAddress(sel);
            return {
              selectionBySheetId,
              pending: { ...s.pending, values: { ...s.pending.values, [s.pending.pickingKey]: addr } },
            };
          }),

        setSidebarMode: (mode) => set({ sidebarMode: mode }),
        toggleFormatBar: () => set((s) => ({ formatBarOpen: !s.formatBarOpen })),
        toggleSidebar: (mode) => set((s) => ({ sidebarMode: s.sidebarMode === mode ? "none" : mode })),

        addLiveBlock: (input, table) =>
          set((s) => ({
            sheets: s.sheets.map((tab) => {
              if (tab.id !== s.activeSheetId) return tab;
              let block: LiveBlock = { ...input, id: `live-${Date.now().toString(36)}-${idCounter++}`, rows: 0, cols: 0 };
              let sheet = tab.sheet;
              if (table) {
                const written = writeLiveBlock(sheet, block, liveBlockCells(block, table));
                sheet = written.sheet;
                block = { ...block, rows: written.rows, cols: written.cols };
              }
              return { ...tab, sheet, liveBlocks: [...(tab.liveBlocks ?? []), block] };
            }),
          })),

        replaceLiveBlock: (blockId, input, table) =>
          set((s) => ({
            sheets: s.sheets.map((tab) => {
              const old = tab.liveBlocks?.find((b) => b.id === blockId);
              if (!old) return tab;
              let sheet = clearLiveBlock(tab.sheet, old);
              let next: LiveBlock = { ...input, id: old.id, rows: 0, cols: 0 };
              if (table) {
                const written = writeLiveBlock(sheet, next, liveBlockCells(next, table));
                sheet = written.sheet;
                next = { ...next, rows: written.rows, cols: written.cols };
              }
              return { ...tab, sheet, liveBlocks: tab.liveBlocks!.map((b) => (b.id === blockId ? next : b)) };
            }),
          })),

        removeLiveBlock: (blockId) =>
          set((s) => ({
            sheets: s.sheets.map((tab) => {
              const block = tab.liveBlocks?.find((b) => b.id === blockId);
              if (!block) return tab;
              return {
                ...tab,
                sheet: clearLiveBlock(tab.sheet, block),
                liveBlocks: tab.liveBlocks!.filter((b) => b.id !== blockId),
              };
            }),
          })),

        removeLiveBlocksForSource: (sourceId) =>
          set((s) => ({
            sheets: s.sheets.map((tab) => {
              const doomed = (tab.liveBlocks ?? []).filter((b) => b.sourceId === sourceId);
              if (doomed.length === 0) return tab;
              return {
                ...tab,
                sheet: doomed.reduce((sheet, b) => clearLiveBlock(sheet, b), tab.sheet),
                liveBlocks: tab.liveBlocks!.filter((b) => b.sourceId !== sourceId),
              };
            }),
          })),

        applyLiveData: (sourceId, table) => {
          const temporal = useSheetStore.temporal.getState();
          temporal.pause();
          try {
            set((s) => ({
              sheets: s.sheets.map((tab) => {
                const blocks = tab.liveBlocks ?? [];
                if (!blocks.some((b) => b.sourceId === sourceId)) return tab;
                let sheet = tab.sheet;
                const liveBlocks = blocks.map((b) => {
                  if (b.sourceId !== sourceId) return b;
                  const written = writeLiveBlock(sheet, b, liveBlockCells(b, table));
                  sheet = written.sheet;
                  return { ...b, rows: written.rows, cols: written.cols };
                });
                return { ...tab, sheet, liveBlocks };
              }),
            }));
          } finally {
            temporal.resume();
          }
        },

        openFormulaPanel: (def, anchorRow, anchorCol) => {
          const sel = activeSelectionOf(get());
          const values: Record<string, string> = {};
          let usedSelection = false;
          for (const p of def.params) {
            if (p.options) {
              values[p.key] = p.defaultValue ?? p.options[0].value;
              continue;
            }
            if (!usedSelection && (p.type === "range" || p.type === "cell")) {
              if (p.type === "range" && !isSingleCell(sel)) {
                values[p.key] = rangeRefString(sel.startRow, sel.startCol, sel.endRow, sel.endCol);
              } else if (p.type === "cell") {
                values[p.key] = cellRef(sel.anchorRow, sel.anchorCol);
              } else {
                values[p.key] = "";
              }
              usedSelection = true;
            } else {
              values[p.key] = p.defaultValue ?? "";
            }
          }
          set({ pending: { def, anchorRow, anchorCol, values, pickingKey: null, scope: "cell" } });
        },

        updatePending: (pending) => set({ pending }),
        cancelPending: () => set({ pending: null }),

        insertPending: () => {
          const { pending } = get();
          if (!pending) return;
          let body: string;
          try {
            body = pending.def.build(pending.values);
          } catch {
            return;
          }
          set((s) => ({
            sheets: updateActiveSheet(s, (sheet, selection) =>
              applyFormula(sheet, body, {
                scope: pending.scope,
                anchorRow: pending.anchorRow,
                anchorCol: pending.anchorCol,
                selection: {
                  startRow: selection.startRow,
                  startCol: selection.startCol,
                  endRow: selection.endRow,
                  endCol: selection.endCol,
                },
              })
            ),
            pending: null,
          }));
        },

        insertAIFormula: (formula) =>
          set((s) => ({
            sheets: updateActiveSheet(s, (sheet, selection) => {
              const raw = formula.startsWith("=") ? formula : `=${formula}`;
              return setCellRaw(sheet, selection.anchorRow, selection.anchorCol, raw);
            }),
          })),

        importFromFile: async (file) => {
          set({ busy: getMessages().store.busyImporting });
          try {
            // A .csv is plain text, so it never reaches ExcelJS — which would reject it anyway.
            // The delimiter is sniffed rather than assumed: Excel writes the list separator of the
            // machine's locale, and a semicolon file read as comma-separated lands every row in
            // column A, which looks like a broken app rather than a wrong guess.
            if (/\.csv$/i.test(file.name)) {
              const { parseCsv } = await import("@/lib/csv");
              const rows = parseCsv(await file.text());
              if (rows.length === 0) {
                alert(getMessages().store.importError);
                return;
              }
              // Cells hold raw text and computeSheet coerces numeric-looking strings when it reads
              // them, so the values go in as they came out of the file.
              const sheet = sheetFromGrid(rows);
              const name = file.name.replace(/\.csv$/i, "").slice(0, 31) || "CSV";
              const sheets = [newTab(name, sheet)];
              set({ sheets, activeSheetId: sheets[0].id, selectionBySheetId: {}, filtersBySheetId: {} });
              return;
            }
            const { importWorkbookFromFile } = await import("@/lib/excelIO");
            const imported = await importWorkbookFromFile(file);
            const sheets = imported.map((w) => newTab(w.name, w.sheet));
            set({ sheets, activeSheetId: sheets[0].id });
          } catch (err) {
            console.error(err);
            alert(getMessages().store.importError);
          } finally {
            set({ busy: null });
          }
        },

        /**
         * Swaps the whole document for another one — opening a workbook from the optional cloud
         * backend. Selections and filters are keyed by sheet id, and the incoming ids are not the
         * outgoing ones, so they are cleared rather than left pointing at sheets that are gone.
         */
        replaceWorkbook: (sheets) => {
          if (sheets.length === 0) return;
          set({ sheets, activeSheetId: sheets[0].id, selectionBySheetId: {}, filtersBySheetId: {}, pending: null });
        },

        exportXlsx: async () => {
          set({ busy: getMessages().store.busyExportingXlsx });
          try {
            const sheets = get().sheets.map((t) => ({ name: t.name, sheet: t.sheet, computed: computeSheet(t.sheet) }));
            const { exportWorkbookToXlsxBlob, downloadBlob } = await import("@/lib/excelIO");
            const blob = await exportWorkbookToXlsxBlob(sheets);
            downloadBlob(blob, "ExcelToGo.xlsx");
          } finally {
            set({ busy: null });
          }
        },

        // Async now that charts are rasterised into the file, and busy-flagged like the .xlsx
        // export: a sheet with several charts takes long enough that a dead-looking button would
        // get pressed twice.
        exportPdf: async () => {
          set({ busy: getMessages().store.busyExportingPdf });
          try {
            const tab = activeTab(get());
            const { exportSheetToPdf } = await import("@/lib/pdfExport");
            await exportSheetToPdf(tab.sheet, computeSheet(tab.sheet), tab.name);
          } finally {
            set({ busy: null });
          }
        },

        /**
         * Writes the active sheet as CSV.
         *
         * The active sheet alone, because a CSV is one table — a workbook of three would have to
         * become three files or one with the sheets stacked, and both are surprises. The tab's name
         * becomes the filename so which one it was is not a guess.
         */
        exportCsv: async () => {
          set({ busy: getMessages().store.busyExportingCsv });
          try {
            const tab = activeTab(get());
            const { toCsv, trimGrid, valuesToCsvGrid } = await import("@/lib/csv");
            const grid = trimGrid(valuesToCsvGrid(computeSheet(tab.sheet).values));
            if (grid.length === 0) {
              alert(getMessages().store.csvEmpty);
              return;
            }
            const { downloadBlob } = await import("@/lib/excelIO");
            // text/csv with an explicit charset, and toCsv writes the BOM: between them, Excel on
            // Windows opens Thai as Thai instead of guessing a legacy code page.
            const blob = new Blob([toCsv(grid)], { type: "text/csv;charset=utf-8" });
            const safeName = tab.name.replace(/[\\/:*?"<>|]/g, "_").trim() || "sheet";
            downloadBlob(blob, `${safeName}.csv`);
          } finally {
            set({ busy: null });
          }
        },
      }),
      {
        limit: 100,
        partialize: (s): TemporalSlice => ({ sheets: s.sheets }),
        // `partialize` above returns a fresh `{ sheets }` wrapper object every call, so the
        // default reference-equality check would treat every action (even ones that only
        // touch `selection` or `pending`) as a content change and pollute the undo history.
        // Compare the actual `sheets` array reference instead.
        equality: (a, b) => a.sheets === b.sheets,
      }
    ),
    {
      name: "exceltogo-sheet-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (s): PersistedSlice => ({ sheets: s.sheets, activeSheetId: s.activeSheetId }),
      // Rehydration is triggered manually (see useHydrateSheetStore) after the first client
      // render, so the server-rendered HTML and the client's initial render match exactly —
      // reading localStorage during store creation would make them diverge and trigger a
      // React hydration mismatch.
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as Partial<PersistedSlice> | undefined;
        const sheets = p?.sheets;
        if (!sheets || sheets.length === 0) return current;
        const activeSheetId = sheets.some((t) => t.id === p.activeSheetId) ? p.activeSheetId! : sheets[0].id;
        return { ...current, sheets, activeSheetId };
      },
    }
  )
);

/** Reads any autosaved sheets from localStorage once, after the initial render has already
 *  matched the server-rendered HTML. Call once near the root of the app. */
export function useHydrateSheetStore() {
  useEffect(() => {
    useSheetStore.persist.rehydrate();
  }, []);
}

export function selectActiveSheet(s: SheetState): SheetModel {
  return activeTab(s).sheet;
}

export function selectActiveSelection(s: SheetState): SelectionRect {
  return activeSelectionOf(s);
}

/** Recomputes derived cell values/display strings, memoized on the active sheet's reference. */
export function useComputedSheet() {
  const sheet = useSheetStore(selectActiveSheet);
  return useMemo(() => computeSheet(sheet), [sheet]);
}

export function useSelectionAddress() {
  const selection = useSheetStore(selectActiveSelection);
  return selectionToAddress(selection);
}

const EMPTY_FORMAT: CellFormat = {};

/** The format of the selection's anchor cell — used to reflect e.g. "is Bold active" in the
 *  formatting toolbar's toggle buttons. Falls back to a module-level constant (rather than a
 *  fresh `{}` per call) so the selector returns a stable reference when there's no format,
 *  which Zustand's snapshot comparison requires to avoid re-rendering forever. */
/** What the pivot banner needs to know: nothing, out of date, or orphaned. */
export type PivotStatus = "fresh" | "stale" | "orphaned";

/**
 * Whether the active sheet is a pivot, and whether its source has moved since it was built.
 *
 * Recomputing the source range and hashing it on every store read is the cost of not making the
 * pivot live — and it is small, because a pivot's source is a block someone selected by hand, not
 * the whole sheet.
 */
export function selectPivotStatus(s: SheetState): PivotStatus | null {
  const spec = activeTab(s).sheet.pivot;
  if (!spec) return null;
  const source = s.sheets.find((t) => t.id === spec.sheetId);
  if (!source) return "orphaned";

  const computed = computeSheet(source.sheet);
  const rows: FormulaValue[][] = [];
  for (let r = spec.range.startRow; r <= spec.range.endRow; r++) {
    const row: FormulaValue[] = [];
    for (let c = spec.range.startCol; c <= spec.range.endCol; c++) row.push(computed.values[r]?.[c] ?? null);
    rows.push(row);
  }
  return hashValues(rows) === spec.hash ? "fresh" : "stale";
}

export function useAnchorFormat(): CellFormat {
  return useSheetStore((s) => {
    const sheet = activeTab(s).sheet;
    const selection = activeSelectionOf(s);
    return sheet.formats[selection.anchorRow]?.[selection.anchorCol] ?? EMPTY_FORMAT;
  });
}

const EMPTY_LIVE_BLOCKS: LiveBlock[] = [];

/** The active sheet's live-data blocks (stable empty array when there are none). */
export function useLiveBlocks(): LiveBlock[] {
  return useSheetStore((s) => activeTab(s).liveBlocks ?? EMPTY_LIVE_BLOCKS);
}

/** "row,col" → owning block for the active sheet, so the grid can tint, outline and protect live cells. */
export function useBoundCells(): Map<string, LiveBlock> {
  const blocks = useLiveBlocks();
  return useMemo(() => boundCellsOf(blocks), [blocks]);
}

const EMPTY_FILTERS: Record<number, string[]> = {};

export function useActiveFilters(): Record<number, string[]> {
  return useSheetStore((s) => s.filtersBySheetId[s.activeSheetId] ?? EMPTY_FILTERS);
}

export function useColumnFilter(col: number): string[] | null {
  const filters = useActiveFilters();
  return filters[col] ?? null;
}

const EMPTY_HIDDEN_ROWS: ReadonlySet<number> = new Set();

/** Rows to hide in the grid because they don't match one or more active column filters. */
export function useHiddenRows(): ReadonlySet<number> {
  const filters = useActiveFilters();
  const { display } = useComputedSheet();
  return useMemo(() => {
    const cols = Object.keys(filters);
    if (cols.length === 0) return EMPTY_HIDDEN_ROWS;
    const hidden = new Set<number>();
    rows: for (let r = 0; r < display.length; r++) {
      for (const colStr of cols) {
        const col = Number(colStr);
        const value = display[r]?.[col] ?? "";
        if (!filters[col].includes(value)) {
          hidden.add(r);
          continue rows;
        }
      }
    }
    return hidden;
  }, [filters, display]);
}

/** Unique display values in a column, for populating that column's filter checkbox list. */
export function useUniqueColumnValues(col: number): string[] {
  const { display } = useComputedSheet();
  return useMemo(() => {
    const set = new Set<string>();
    for (const row of display) set.add(row[col] ?? "");
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [display, col]);
}

export function useCanUndo() {
  return useStore(useSheetStore.temporal, (s) => s.pastStates.length > 0);
}

export function useCanRedo() {
  return useStore(useSheetStore.temporal, (s) => s.futureStates.length > 0);
}

export function undoSheet() {
  useSheetStore.temporal.getState().undo();
}

export function redoSheet() {
  useSheetStore.temporal.getState().redo();
}

/** Global Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y (redo) shortcuts. Ignored while
 *  focus is inside a text input/textarea so the browser's native undo for that field still works. */
export function useUndoRedoShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (!mod || (key !== "z" && key !== "y")) return;
      e.preventDefault();
      if (key === "y" || (key === "z" && e.shiftKey)) {
        redoSheet();
      } else {
        undoSheet();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

/** Ctrl/Cmd+C copies the current selection, Ctrl/Cmd+X cuts it, and the browser's native
 *  `paste` event (fired for Ctrl/Cmd+V, right-click paste, or the Edit menu alike) pastes it —
 *  reading `clipboardData` directly instead of the async, permission-gated Clipboard API so a
 *  paste from another app (e.g. real Excel) works too. All ignored while a text input/textarea
 *  has focus so native copy/paste in that field keeps working. */
export function useClipboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (!mod || (key !== "c" && key !== "x")) return;
      e.preventDefault();
      const { copySelection, cutSelection } = useSheetStore.getState();
      if (key === "c") copySelection();
      else cutSelection();
    }
    function handlePaste(e: ClipboardEvent) {
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain");
      useSheetStore.getState().pasteAtSelection(text);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("paste", handlePaste);
    };
  }, []);
}
