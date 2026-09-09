import { useMemo } from "react";
import { create } from "zustand";
import {
  addColumn,
  addRow,
  applyFormula,
  ApplyScope,
  computeSheet,
  createEmptySheet,
  setCellRaw,
  SheetModel,
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

interface SheetState {
  sheet: SheetModel;
  selection: SelectionRect;
  pending: PendingFormula | null;
  sidebarMode: SidebarMode;
  busy: string | null;

  setCellRaw: (row: number, col: number, raw: string) => void;
  addRow: () => void;
  addColumn: () => void;
  setSelection: (sel: SelectionRect) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  toggleSidebar: (mode: "palette" | "ai") => void;

  openFormulaPanel: (def: FormulaDef, anchorRow: number, anchorCol: number) => void;
  updatePending: (pending: PendingFormula) => void;
  insertPending: () => void;
  cancelPending: () => void;

  insertAIFormula: (formula: string) => void;

  importFromFile: (file: File) => Promise<void>;
  exportXlsx: () => Promise<void>;
  exportPdf: () => void;
}

export const useSheetStore = create<SheetState>((set, get) => ({
  sheet: seedSample(),
  selection: singleCellSelection(0, 0),
  pending: null,
  sidebarMode: "palette",
  busy: null,

  setCellRaw: (row, col, raw) => set((s) => ({ sheet: setCellRaw(s.sheet, row, col, raw) })),
  addRow: () => set((s) => ({ sheet: addRow(s.sheet) })),
  addColumn: () => set((s) => ({ sheet: addColumn(s.sheet) })),

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
}));

/** Recomputes derived cell values/display strings, memoized on the sheet reference. */
export function useComputedSheet() {
  const sheet = useSheetStore((s) => s.sheet);
  return useMemo(() => computeSheet(sheet), [sheet]);
}

export function useSelectionAddress() {
  const selection = useSheetStore((s) => s.selection);
  return selectionToAddress(selection);
}
