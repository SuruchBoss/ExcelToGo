"use client";

import { useMemo, useState } from "react";
import Toolbar from "@/components/Toolbar";
import SpreadsheetGrid from "@/components/SpreadsheetGrid";
import FormulaPalette from "@/components/FormulaPalette";
import FormulaParamPanel, { PendingFormula } from "@/components/FormulaParamPanel";
import AIAssistantPanel from "@/components/AIAssistantPanel";
import { FORMULA_CATALOG, FormulaDef } from "@/lib/formulaCatalog";
import {
  addColumn,
  addRow,
  applyFormula,
  computeSheet,
  createEmptySheet,
  setCellRaw,
  SheetModel,
} from "@/lib/sheet";
import { cellRef, rangeRefString } from "@/lib/formulaEngine/address";
import { downloadBlob, exportSheetToXlsxBlob, importWorkbookFromFile } from "@/lib/excelIO";
import { exportSheetToPdf } from "@/lib/pdfExport";
import { isSingleCell, singleCellSelection, SelectionRect } from "@/types/sheet-ui";

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

type SidebarMode = "palette" | "ai" | "none";

export default function Home() {
  const [sheet, setSheet] = useState<SheetModel>(seedSample);
  const [selection, setSelection] = useState<SelectionRect>(singleCellSelection(0, 0));
  const [pending, setPending] = useState<PendingFormula | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("palette");
  const [busy, setBusy] = useState<string | null>(null);

  const computed = useMemo(() => computeSheet(sheet), [sheet]);

  const rawAt = (row: number, col: number) => sheet.cells[row]?.[col] ?? "";

  const selectionAddress = isSingleCell(selection)
    ? cellRef(selection.anchorRow, selection.anchorCol)
    : rangeRefString(selection.startRow, selection.startCol, selection.endRow, selection.endCol);

  function openFormulaPanel(def: FormulaDef, anchorRow: number, anchorCol: number, sel: SelectionRect) {
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
    setPending({ def, anchorRow, anchorCol, values, pickingKey: null, scope: "cell" });
  }

  function handlePickFromPalette(def: FormulaDef) {
    openFormulaPanel(def, selection.anchorRow, selection.anchorCol, selection);
  }

  function handleFormulaDrop(row: number, col: number, formulaId: string) {
    const def = FORMULA_LOOKUP[formulaId];
    if (!def) return;
    openFormulaPanel(def, row, col, selection);
  }

  function handleSelectionChange(sel: SelectionRect) {
    setSelection(sel);
    if (pending?.pickingKey) {
      const addr = isSingleCell(sel)
        ? cellRef(sel.anchorRow, sel.anchorCol)
        : rangeRefString(sel.startRow, sel.startCol, sel.endRow, sel.endCol);
      setPending({ ...pending, values: { ...pending.values, [pending.pickingKey]: addr } });
    }
  }

  function handleInsertPending() {
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
    setSheet(next);
    setPending(null);
  }

  function handleAIInsert(formula: string) {
    const raw = formula.startsWith("=") ? formula : `=${formula}`;
    setSheet(setCellRaw(sheet, selection.anchorRow, selection.anchorCol, raw));
  }

  async function handleImport(file: File) {
    setBusy("กำลังนำเข้าไฟล์...");
    try {
      const newSheet = await importWorkbookFromFile(file);
      setSheet(newSheet);
      setSelection(singleCellSelection(0, 0));
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถนำเข้าไฟล์นี้ได้ กรุณาตรวจสอบว่าเป็นไฟล์ Excel (.xlsx) ที่ถูกต้อง");
    } finally {
      setBusy(null);
    }
  }

  async function handleExportXlsx() {
    setBusy("กำลังสร้างไฟล์ Excel...");
    try {
      const blob = await exportSheetToXlsxBlob(sheet, computed);
      downloadBlob(blob, "ExcelToGo.xlsx");
    } finally {
      setBusy(null);
    }
  }

  function handleExportPdf() {
    exportSheetToPdf(sheet, computed, "ExcelToGo");
  }

  const showFormulaPanel = !!pending;

  return (
    <div className="flex h-screen flex-col bg-zinc-50">
      <Toolbar
        onImport={handleImport}
        onExportXlsx={handleExportXlsx}
        onExportPdf={handleExportPdf}
        onAddRow={() => setSheet(addRow(sheet))}
        onAddColumn={() => setSheet(addColumn(sheet))}
        onToggleAI={() => setSidebarMode((m) => (m === "ai" ? "none" : "ai"))}
        onTogglePalette={() => setSidebarMode((m) => (m === "palette" ? "none" : "palette"))}
        aiOpen={sidebarMode === "ai" && !showFormulaPanel}
        paletteOpen={sidebarMode === "palette" && !showFormulaPanel}
        busy={busy}
      />
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <div className="min-w-0 flex-1">
          <SpreadsheetGrid
            sheet={sheet}
            values={computed.values}
            display={computed.display}
            selection={selection}
            onSelectionChange={handleSelectionChange}
            onCellCommit={(r, c, raw) => setSheet(setCellRaw(sheet, r, c, raw))}
            onFormulaDrop={handleFormulaDrop}
            rawAt={rawAt}
          />
        </div>
        {(showFormulaPanel || sidebarMode !== "none") && (
          <aside className="w-80 shrink-0 rounded-lg border border-zinc-200 bg-white p-3">
            {showFormulaPanel && pending ? (
              <FormulaParamPanel
                pending={pending}
                selection={selection}
                onChange={setPending}
                onInsert={handleInsertPending}
                onCancel={() => setPending(null)}
              />
            ) : sidebarMode === "palette" ? (
              <FormulaPalette onPick={handlePickFromPalette} />
            ) : (
              <AIAssistantPanel selectionAddress={selectionAddress} onInsert={handleAIInsert} />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

const FORMULA_LOOKUP: Record<string, FormulaDef> = Object.fromEntries(FORMULA_CATALOG.map((f) => [f.id, f]));
