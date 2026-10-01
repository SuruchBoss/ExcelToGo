// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { cleanSheetName, nextSheetName, sheetNameProblem, uniqueSheetName } from "./sheetNames";
import { fitSheetNames } from "./workbookRefs";
import { createEmptySheet, SheetModel } from "./sheet";

/** Excel's sheet-name rules (#54), and the workbook-wide fix for names saved before them. */

const withCells = (cells: [number, number, string][]): SheetModel => {
  const sheet = createEmptySheet();
  for (const [r, c, v] of cells) sheet.cells[r][c] = v;
  return sheet;
};

describe("what Excel will take as a sheet name", () => {
  it("names each rule it breaks", () => {
    expect(sheetNameProblem("   ", [])).toBe("empty");
    expect(sheetNameProblem("x".repeat(31), [])).toBeNull();
    expect(sheetNameProblem("x".repeat(32), [])).toBe("tooLong");
    for (const ch of ["\\", "/", "?", "*", "[", "]", ":"]) expect(sheetNameProblem(`Q1${ch}Q2`, [])).toBe("badChar");
    expect(sheetNameProblem("'quoted", [])).toBe("apostrophe");
    expect(sheetNameProblem("quoted'", [])).toBe("apostrophe");
    expect(sheetNameProblem("it's fine", [])).toBeNull();
    expect(sheetNameProblem("HISTORY", [])).toBe("reserved");
    expect(sheetNameProblem("ยอดขาย ปี 2567", [])).toBeNull();
  });

  it("counts upper and lower case as one name, as Excel does", () => {
    expect(sheetNameProblem("sheet1", ["Sheet1", "Sheet2"])).toBe("taken");
    expect(sheetNameProblem(" SHEET2 ", ["Sheet1", "Sheet2"])).toBe("taken");
    expect(sheetNameProblem("Sheet3", ["Sheet1", "Sheet2"])).toBeNull();
  });

  it("cleans a name into one Excel accepts, and finds a free one", () => {
    expect(cleanSheetName("Q1/Q2")).toBe("Q1 Q2");
    expect(cleanSheetName("'[draft]'")).toBe("draft");
    expect(cleanSheetName("///")).toBe("Sheet");
    expect(cleanSheetName("history")).toBe("Sheet");
    expect(cleanSheetName("ยอดขายรายเดือนของสาขาภาคตะวันออกเฉียงเหนือ")).toHaveLength(31);
    expect(uniqueSheetName("Sheet1", new Set(["sheet1", "sheet1 (2)"]))).toBe("Sheet1 (3)");
    const long = uniqueSheetName("x".repeat(31), new Set(["x".repeat(31)]));
    expect(long).toHaveLength(31);
    expect(long.endsWith(" (2)")).toBe(true);
  });

  it("gives the + button a name no tab has (QA's case (a): delete Sheet2 of three, add one)", () => {
    expect(nextSheetName(["Sheet1", "Sheet3"])).toBe("Sheet4");
    expect(nextSheetName(["Sheet1", "sheet3", "Sheet4"])).toBe("Sheet5");
    expect(nextSheetName(["Sheet1"])).toBe("Sheet2");
  });
});

describe("fitting a workbook's names (a save or file from before #54)", () => {
  it("leaves a clean workbook alone, to the object", () => {
    const tabs = [
      { name: "Sheet1", sheet: createEmptySheet() },
      { name: "ยอดขาย", sheet: createEmptySheet() },
    ];
    expect(fitSheetNames(tabs)).toBe(tabs);
  });

  it("keeps a duplicated name on the first tab, so its formulas go on reading the first", () => {
    const tabs = [
      { name: "Sheet1", sheet: withCells([[0, 0, "=Sheet3!A1"]]) },
      { name: "Sheet3", sheet: withCells([[0, 0, "333"]]) },
      { name: "Sheet3", sheet: withCells([[0, 0, "999"]]) },
      { name: "sheet1", sheet: createEmptySheet() },
    ];
    const fitted = fitSheetNames(tabs);
    expect(fitted.map((t) => t.name)).toEqual(["Sheet1", "Sheet3", "Sheet3 (2)", "sheet1 (2)"]);
    expect(fitted[0].sheet.cells[0][0]).toBe("=Sheet3!A1");
    expect(fitted[2].sheet).toBe(tabs[2].sheet);
  });

  it("renames an invalid name together with the formulas that point at it", () => {
    const tabs = [
      { name: "Sheet1", sheet: withCells([[0, 0, "='Q1/Q2'!A1*2"], [1, 0, "=SUM('Q1/Q2'!A1:A3)"]]) },
      { name: "Q1/Q2", sheet: withCells([[0, 0, "21"]]) },
      { name: "Q1 Q2", sheet: createEmptySheet() },
    ];
    const fitted = fitSheetNames(tabs);
    expect(fitted.map((t) => t.name)).toEqual(["Sheet1", "Q1 Q2 (2)", "Q1 Q2"]);
    expect(fitted[0].sheet.cells[0][0]).toBe("='Q1 Q2 (2)'!A1*2");
    expect(fitted[0].sheet.cells[1][0]).toBe("=SUM('Q1 Q2 (2)'!A1:A3)");
  });
});
