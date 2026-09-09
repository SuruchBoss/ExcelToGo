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
  clearRange,
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
  setRangeFormat,
  SheetModel,
  sortRange,
  toTsv,
} from "@/lib/sheet";
import { cellRef, rangeRefString } from "@/lib/formulaEngine/address";
import { downloadBlob, exportWorkbookToXlsxBlob, importWorkbookFromFile } from "@/lib/excelIO";
import { exportSheetToPdf } from "@/lib/pdfExport";
import { FormulaDef } from "@/lib/formulaCatalog";
import { isSingleCell, singleCellSelection, SelectionRect } from "@/types/sheet-ui";

export type SidebarMode = "palette" | "ai" | "none";
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
}

function seedSample(): SheetModel {
  const sheet = createEmptySheet();
  const header = ["สินค้า", "หมวดหมู่", "ราคา", "จำนวน", "รวม"];
  header.forEach((h, c) => (sheet.cells[0][c] = h));
  const rows: [string, string, number, number][] = [
    ["กาแฟ", "เครื่องดื่ม", 45, 12],
    ["ขนมปัง", "เบเกอรี่", 30, 8],
    ["นม", "เครื่องดื่ม", 25, 20],
  ];
  rows.forEach((row, r) => {
    sheet.cells[r + 1][0] = row[0];
    sheet.cells[r + 1][1] = row[1];
    sheet.cells[r + 1][2] = String(row[2]);
    sheet.cells[r + 1][3] = String(row[3]);
    sheet.cells[r + 1][4] = `=C${r + 2}*D${r + 2}`;
  });
  sheet.cells[5][3] = "รวมทั้งหมด";
  sheet.cells[5][4] = "=SUM(E2:E4)";
  return sheet;
}

let idCounter = 0;
function genId(): string {
  idCounter += 1;
  return `sheet-${Date.now().toString(36)}-${idCounter}`;
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
  busy: string | null;
  clipboard: ClipboardState | null;

  setActiveSheet: (id: string) => void;
  addSheet: () => void;
  renameSheet: (id: string, name: string) => void;
  deleteSheet: (id: string) => void;

  setCellRaw: (row: number, col: number, raw: string) => void;
  addRow: () => void;
  addColumn: () => void;
  deleteSelectedRow: () => void;
  deleteSelectedColumn: () => void;
  insertRowAtSelection: () => void;
  insertColumnAtSelection: () => void;
  setSelection: (sel: SelectionRect) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  toggleSidebar: (mode: "palette" | "ai") => void;

  clearSelection: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteAtSelection: (externalText?: string) => void;
  clearClipboard: () => void;

  sortSelection: (ascending: boolean) => void;
  setColumnFilter: (col: number, values: string[]) => void;
  clearColumnFilter: (col: number) => void;
  clearAllFilters: () => void;

  toggleBold: () => void;
  setAlign: (align: CellAlign) => void;
  setTextColor: (color: string) => void;
  setNumberFormat: (fmt: NumberFormat) => void;

  openFormulaPanel: (def: FormulaDef, anchorRow: number, anchorCol: number) => void;
  updatePending: (pending: PendingFormula) => void;
  insertPending: () => void;
  cancelPending: () => void;

  insertAIFormula: (formula: string) => void;

  importFromFile: (file: File) => Promise<void>;
  exportXlsx: () => Promise<void>;
  exportPdf: () => void;
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

/** Only the sheet tabs' content is tracked for undo/redo — switching tabs isn't something
 *  users expect Ctrl+Z to step through. */
type TemporalSlice = Pick<SheetState, "sheets">;

/** Autosaved to localStorage: the tabs' content plus which one was active, so reloading lands
 *  back on the same tab. Other UI-only state (an open formula panel, which sidebar is open)
 *  resets on reload. */
type PersistedSlice = Pick<SheetState, "sheets" | "activeSheetId">;

const initialTab = newTab("Sheet1", seedSample());

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
        busy: null,
        clipboard: null,

        setActiveSheet: (id) => set({ activeSheetId: id }),

        addSheet: () => {
          const s = get();
          const tab = newTab(`Sheet${s.sheets.length + 1}`);
          set({ sheets: [...s.sheets, tab], activeSheetId: tab.id });
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
          set((s) => ({ sheets: withActiveSheet(s, (tab) => setCellRaw(tab.sheet, row, col, raw)) })),
        addRow: () => set((s) => ({ sheets: withActiveSheet(s, (tab) => addRow(tab.sheet)) })),
        addColumn: () => set((s) => ({ sheets: withActiveSheet(s, (tab) => addColumn(tab.sheet)) })),

        deleteSelectedRow: () =>
          set((s) => {
            const { sheet } = activeTab(s);
            const selection = activeSelectionOf(s);
            const next = deleteRow(sheet, selection.anchorRow);
            const row = Math.min(selection.anchorRow, next.rows - 1);
            const col = Math.min(selection.anchorCol, next.cols - 1);
            return {
              sheets: withActiveSheet(s, () => next),
              selectionBySheetId: { ...s.selectionBySheetId, [s.activeSheetId]: singleCellSelection(row, col) },
            };
          }),

        deleteSelectedColumn: () =>
          set((s) => {
            const { sheet } = activeTab(s);
            const selection = activeSelectionOf(s);
            const next = deleteColumn(sheet, selection.anchorCol);
            const row = Math.min(selection.anchorRow, next.rows - 1);
            const col = Math.min(selection.anchorCol, next.cols - 1);
            return {
              sheets: withActiveSheet(s, () => next),
              selectionBySheetId: { ...s.selectionBySheetId, [s.activeSheetId]: singleCellSelection(row, col) },
            };
          }),

        insertRowAtSelection: () =>
          set((s) => {
            const { sheet } = activeTab(s);
            const selection = activeSelectionOf(s);
            return { sheets: withActiveSheet(s, () => insertRowBefore(sheet, selection.anchorRow)) };
          }),

        insertColumnAtSelection: () =>
          set((s) => {
            const { sheet } = activeTab(s);
            const selection = activeSelectionOf(s);
            return { sheets: withActiveSheet(s, () => insertColumnBefore(sheet, selection.anchorCol)) };
          }),

        clearSelection: () =>
          set((s) => {
            const { sheet } = activeTab(s);
            const selection = activeSelectionOf(s);
            const next = clearRange(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol);
            return { sheets: withActiveSheet(s, () => next) };
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
            const { sheet } = activeTab(s);
            const selection = activeSelectionOf(s);
            const computed = computeSheet(sheet);
            const range = detectSortRange(sheet, computed, selection, selection.anchorRow, selection.anchorCol);
            const next = sortRange(sheet, computed, range, selection.anchorCol, ascending);
            return { sheets: withActiveSheet(s, () => next) };
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
          set((s) => {
            const { sheet } = activeTab(s);
            const selection = activeSelectionOf(s);
            const anchorBold = getCellFormat(sheet, selection.anchorRow, selection.anchorCol).bold;
            const next = setRangeFormat(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol, {
              bold: !anchorBold,
            });
            return { sheets: withActiveSheet(s, () => next) };
          }),

        setAlign: (align) =>
          set((s) => {
            const { sheet } = activeTab(s);
            const selection = activeSelectionOf(s);
            const next = setRangeFormat(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol, {
              align,
            });
            return { sheets: withActiveSheet(s, () => next) };
          }),

        setTextColor: (color) =>
          set((s) => {
            const { sheet } = activeTab(s);
            const selection = activeSelectionOf(s);
            const next = setRangeFormat(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol, {
              color,
            });
            return { sheets: withActiveSheet(s, () => next) };
          }),

        setNumberFormat: (numberFormat) =>
          set((s) => {
            const { sheet } = activeTab(s);
            const selection = activeSelectionOf(s);
            const next = setRangeFormat(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol, {
              numberFormat,
            });
            return { sheets: withActiveSheet(s, () => next) };
          }),

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
        toggleSidebar: (mode) => set((s) => ({ sidebarMode: s.sidebarMode === mode ? "none" : mode })),

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

        insertPending: () =>
          set((s) => {
            const { pending } = s;
            if (!pending) return {};
            const { sheet } = activeTab(s);
            const selection = activeSelectionOf(s);
            let body: string;
            try {
              body = pending.def.build(pending.values);
            } catch {
              return {};
            }
            const next = applyFormula(sheet, body, {
              scope: pending.scope,
              anchorRow: pending.anchorRow,
              anchorCol: pending.anchorCol,
              selection: {
                startRow: selection.startRow,
                startCol: selection.startCol,
                endRow: selection.endRow,
                endCol: selection.endCol,
              },
            });
            return { sheets: withActiveSheet(s, () => next), pending: null };
          }),

        insertAIFormula: (formula) =>
          set((s) => {
            const raw = formula.startsWith("=") ? formula : `=${formula}`;
            const { sheet } = activeTab(s);
            const selection = activeSelectionOf(s);
            const next = setCellRaw(sheet, selection.anchorRow, selection.anchorCol, raw);
            return { sheets: withActiveSheet(s, () => next) };
          }),

        importFromFile: async (file) => {
          set({ busy: "กำลังนำเข้าไฟล์..." });
          try {
            const imported = await importWorkbookFromFile(file);
            const sheets = imported.map((w) => newTab(w.name, w.sheet));
            set({ sheets, activeSheetId: sheets[0].id });
          } catch (err) {
            console.error(err);
            alert("ไม่สามารถนำเข้าไฟล์นี้ได้ กรุณาตรวจสอบว่าเป็นไฟล์ Excel (.xlsx) ที่ถูกต้อง");
          } finally {
            set({ busy: null });
          }
        },

        exportXlsx: async () => {
          set({ busy: "กำลังสร้างไฟล์ Excel..." });
          try {
            const sheets = get().sheets.map((t) => ({ name: t.name, sheet: t.sheet, computed: computeSheet(t.sheet) }));
            const blob = await exportWorkbookToXlsxBlob(sheets);
            downloadBlob(blob, "ExcelToGo.xlsx");
          } finally {
            set({ busy: null });
          }
        },

        exportPdf: () => {
          const tab = activeTab(get());
          exportSheetToPdf(tab.sheet, computeSheet(tab.sheet), tab.name);
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
export function useAnchorFormat(): CellFormat {
  return useSheetStore((s) => {
    const sheet = activeTab(s).sheet;
    const selection = activeSelectionOf(s);
    return sheet.formats[selection.anchorRow]?.[selection.anchorCol] ?? EMPTY_FORMAT;
  });
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
