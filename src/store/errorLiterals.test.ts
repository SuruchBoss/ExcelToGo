// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { importWorkbookFromFile } from "@/lib/excelIO";
import { FormulaError, type FormulaValue } from "@/lib/formulaEngine/types";
import { computeSheet, sheetFromGrid } from "@/lib/sheet";
import { computeTab, useSheetStore } from "./sheetStore";

/**
 * An error code that reaches a cell as a value (#226). It used to be text, so `SUM` stepped over a
 * `#DIV/0!` and `IFERROR` let it through, and the total came out clean. Each way in is here: typing,
 * pasting, opening a file, and a pivot writing a group's error.
 */
const state = () => useSheetStore.getState();
const active = () => state().sheets.find((t) => t.id === state().activeSheetId)!;
const values = () => computeTab(active().sheet, state().sheets).values;
const codeOf = (v: FormulaValue) => (v instanceof FormulaError ? v.code : v);

beforeEach(() => state().startBlank());

describe("an error code in a cell reads as the error (#226)", () => {
  it("when typed: SUM gives the error, IFERROR and IFNA catch it", () => {
    state().setCellRaw(0, 0, "100");
    state().setCellRaw(1, 0, "#DIV/0!");
    state().setCellRaw(2, 0, "80");
    state().setCellRaw(3, 0, "#N/A");
    state().setCellRaw(0, 1, "=SUM(A1:A3)");
    state().setCellRaw(1, 1, "=IFERROR(A2,0)");
    state().setCellRaw(2, 1, '=IFNA(A4,"none")');
    state().setCellRaw(3, 1, "=A2*2");
    const v = values();
    expect(codeOf(v[1][0])).toBe("#DIV/0!");
    expect(codeOf(v[0][1])).toBe("#DIV/0!");
    expect(v[1][1]).toBe(0);
    expect(v[2][1]).toBe("none");
    expect(codeOf(v[3][1])).toBe("#DIV/0!");
  });

  it("when pasted, as Excel copies an error cell; text that only starts with # stays text", () => {
    state().setSelection({ startRow: 0, startCol: 0, endRow: 0, endCol: 0, anchorRow: 0, anchorCol: 0 });
    state().pasteAtSelection("100\t#1\r\n#DIV/0!\t#N/A please\r\n80\t'#N/A\r\n");
    state().setCellRaw(3, 0, "=SUM(A1:A3)");
    const v = values();
    expect(codeOf(v[3][0])).toBe("#DIV/0!");
    expect(v.slice(0, 3).map((r) => r[1])).toEqual(["#1", "#N/A please", "#N/A"]);
  });

  it("when opened from a file that holds it as an error cell", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("ยอดขาย");
    ws.getCell("A1").value = { error: "#DIV/0!" } as ExcelJS.CellErrorValue;
    ws.getCell("A2").value = { error: "#N/A" } as ExcelJS.CellErrorValue;
    ws.getCell("A3").value = 5;
    ws.getCell("A4").value = { formula: "SUM(A1:A3)", result: { error: "#DIV/0!" } } as ExcelJS.CellFormulaValue;
    // A string cell that happens to read "#N/A" is text in Excel, and stays text here.
    ws.getCell("B1").value = "#N/A";
    const [{ sheet }] = await importWorkbookFromFile(new File([await wb.xlsx.writeBuffer()], "errors.xlsx"));
    const v = computeSheet(sheet).values;
    expect(codeOf(v[0][0])).toBe("#DIV/0!");
    expect(codeOf(v[1][0])).toBe("#N/A");
    expect(codeOf(v[3][0])).toBe("#DIV/0!");
    expect(v[0][1]).toBe("#N/A");
  });

  it("when a pivot writes a group's error, so a total over the pivot sheet is not clean either", () => {
    useSheetStore.setState((s) => ({
      sheets: s.sheets.map((t, i) =>
        i === 0
          ? {
              ...t,
              sheet: sheetFromGrid([
                ["Region", "Amount"],
                ["North", "100"],
                ["North", "=1/0"],
                ["South", "80"],
              ]),
            }
          : t
      ),
    }));
    state().setSelection({ startRow: 0, startCol: 0, endRow: 3, endCol: 1, anchorRow: 0, anchorCol: 0 });
    expect(state().buildPivotSheet({ rowFields: [0], colField: null, valueField: 1, agg: "sum" })).toBe(true);
    const pivotName = state().sheets[state().sheets.length - 1].name;
    state().setActiveSheet(state().sheets[0].id);
    state().setCellRaw(5, 0, `=SUM('${pivotName}'!B2:B3)`);
    state().setCellRaw(6, 0, `=IFERROR('${pivotName}'!B2,0)`);
    const v = values();
    expect(codeOf(v[5][0])).toBe("#DIV/0!");
    expect(v[6][0]).toBe(0);
  });
});
