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
  getCellFormat,
  NumberFormat,
  parseTsv,
  pasteClipboardBlock,
  pastePlainTextBlock,
  setCellRaw,
  setRangeFormat,
  SheetModel,
  toTsv,
} from "@/lib/sheet";
import { cellRef, rangeRefString } from "@/lib/formulaEngine/address";
import { downloadBlob, exportSheetToXlsxBlob, importWorkbookFromFile } from "@/lib/excelIO";
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

function selectionToAddress(sel: SelectionRect): string {
  return isSingleCell(sel)
    ? cellRef(sel.anchorRow, sel.anchorCol)
    : rangeRefString(sel.startRow, sel.startCol, sel.endRow, sel.endCol);
}

interface ClipboardState extends ClipboardBlock {
  cut: boolean;
}

interface SheetState {
  sheet: SheetModel;
  selection: SelectionRect;
  pending: PendingFormula | null;
  sidebarMode: SidebarMode;
  busy: string | null;
  clipboard: ClipboardState | null;

  setCellRaw: (row: number, col: number, raw: string) => void;
  addRow: () => void;
  addColumn: () => void;
  setSelection: (sel: SelectionRect) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  toggleSidebar: (mode: "palette" | "ai") => void;

  clearSelection: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteAtSelection: (externalText?: string) => void;
  clearClipboard: () => void;

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

/** Only the sheet's cell contents are autosaved and tracked for undo/redo — UI-only state
 *  (selection, an open formula panel, which sidebar tab is active) resets on reload and
 *  isn't something users expect Ctrl+Z to step through. */
type PersistedSlice = Pick<SheetState, "sheet">;

export const useSheetStore = create<SheetState>()(
  persist(
    temporal(
      (set, get) => ({
        sheet: seedSample(),
        selection: singleCellSelection(0, 0),
        pending: null,
        sidebarMode: "palette",
        busy: null,
        clipboard: null,

        setCellRaw: (row, col, raw) => set((s) => ({ sheet: setCellRaw(s.sheet, row, col, raw) })),
        addRow: () => set((s) => ({ sheet: addRow(s.sheet) })),
        addColumn: () => set((s) => ({ sheet: addColumn(s.sheet) })),

        clearSelection: () => {
          const { sheet, selection } = get();
          set({ sheet: clearRange(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol) });
        },

        copySelection: () => {
          const { sheet, selection } = get();
          const block = copyRange(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol);
          set({ clipboard: { ...block, cut: false } });
          navigator.clipboard?.writeText(toTsv(block)).catch(() => {});
        },

        cutSelection: () => {
          const { sheet, selection } = get();
          const block = copyRange(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol);
          set({ clipboard: { ...block, cut: true } });
          navigator.clipboard?.writeText(toTsv(block)).catch(() => {});
        },

        pasteAtSelection: (externalText) => {
          const { sheet, selection, clipboard } = get();
          const targetRow = selection.anchorRow;
          const targetCol = selection.anchorCol;
          if (clipboard) {
            let next = pasteClipboardBlock(sheet, clipboard, targetRow, targetCol);
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
              set({ sheet: next, clipboard: null });
            } else {
              set({ sheet: next });
            }
            return;
          }
          if (externalText) {
            const rows = parseTsv(externalText);
            if (rows.length > 0) set({ sheet: pastePlainTextBlock(sheet, rows, targetRow, targetCol) });
          }
        },

        clearClipboard: () => set({ clipboard: null }),

        toggleBold: () => {
          const { sheet, selection } = get();
          const anchorBold = getCellFormat(sheet, selection.anchorRow, selection.anchorCol).bold;
          set({
            sheet: setRangeFormat(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol, {
              bold: !anchorBold,
            }),
          });
        },

        setAlign: (align) => {
          const { sheet, selection } = get();
          set({
            sheet: setRangeFormat(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol, {
              align,
            }),
          });
        },

        setTextColor: (color) => {
          const { sheet, selection } = get();
          set({
            sheet: setRangeFormat(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol, {
              color,
            }),
          });
        },

        setNumberFormat: (numberFormat) => {
          const { sheet, selection } = get();
          set({
            sheet: setRangeFormat(sheet, selection.startRow, selection.startCol, selection.endRow, selection.endCol, {
              numberFormat,
            }),
          });
        },

        setSelection: (sel) =>
          set((s) => {
            if (!s.pending?.pickingKey) return { selection: sel };
            const addr = selectionToAddress(sel);
            return {
              selection: sel,
              pending: { ...s.pending, values: { ...s.pending.values, [s.pending.pickingKey]: addr } },
            };
          }),

        setSidebarMode: (mode) => set({ sidebarMode: mode }),
        toggleSidebar: (mode) => set((s) => ({ sidebarMode: s.sidebarMode === mode ? "none" : mode })),

        openFormulaPanel: (def, anchorRow, anchorCol) => {
          const sel = get().selection;
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
          const { pending, sheet, selection } = get();
          if (!pending) return;
          let body: string;
          try {
            body = pending.def.build(pending.values);
          } catch {
            return;
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
          set({ sheet: next, pending: null });
        },

        insertAIFormula: (formula) => {
          const raw = formula.startsWith("=") ? formula : `=${formula}`;
          const { sheet, selection } = get();
          set({ sheet: setCellRaw(sheet, selection.anchorRow, selection.anchorCol, raw) });
        },

        importFromFile: async (file) => {
          set({ busy: "กำลังนำเข้าไฟล์..." });
          try {
            const newSheet = await importWorkbookFromFile(file);
            set({ sheet: newSheet, selection: singleCellSelection(0, 0) });
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
            const blob = await exportSheetToXlsxBlob(get().sheet, computeSheet(get().sheet));
            downloadBlob(blob, "ExcelToGo.xlsx");
          } finally {
            set({ busy: null });
          }
        },

        exportPdf: () => {
          const sheet = get().sheet;
          exportSheetToPdf(sheet, computeSheet(sheet), "ExcelToGo");
        },
      }),
      {
        limit: 100,
        partialize: (s): PersistedSlice => ({ sheet: s.sheet }),
        // `partialize` above returns a fresh `{ sheet }` wrapper object every call, so the
        // default reference-equality check would treat every action (even ones that only
        // touch `selection` or `pending`) as a sheet change and pollute the undo history.
        // Compare the actual `sheet` reference instead.
        equality: (a, b) => a.sheet === b.sheet,
      }
    ),
    {
      name: "exceltogo-sheet-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s): PersistedSlice => ({ sheet: s.sheet }),
      // Rehydration is triggered manually (see useHydrateSheetStore) after the first client
      // render, so the server-rendered HTML and the client's initial render match exactly —
      // reading localStorage during store creation would make them diverge and trigger a
      // React hydration mismatch.
      skipHydration: true,
    }
  )
);

/** Reads any autosaved sheet from localStorage once, after the initial render has already
 *  matched the server-rendered HTML. Call once near the root of the app. */
export function useHydrateSheetStore() {
  useEffect(() => {
    useSheetStore.persist.rehydrate();
  }, []);
}

/** Recomputes derived cell values/display strings, memoized on the sheet reference. */
export function useComputedSheet() {
  const sheet = useSheetStore((s) => s.sheet);
  return useMemo(() => computeSheet(sheet), [sheet]);
}

export function useSelectionAddress() {
  const selection = useSheetStore((s) => s.selection);
  return selectionToAddress(selection);
}

const EMPTY_FORMAT: CellFormat = {};

/** The format of the selection's anchor cell — used to reflect e.g. "is Bold active" in the
 *  formatting toolbar's toggle buttons. Falls back to a module-level constant (rather than a
 *  fresh `{}` per call) so the selector returns a stable reference when there's no format,
 *  which Zustand's snapshot comparison requires to avoid re-rendering forever. */
export function useAnchorFormat(): CellFormat {
  return useSheetStore((s) => s.sheet.formats[s.selection.anchorRow]?.[s.selection.anchorCol] ?? EMPTY_FORMAT);
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
