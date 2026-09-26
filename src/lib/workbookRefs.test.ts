// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { createEmptySheet, setCellRaw } from "./sheet";
import { renameSheetInFormulas, shiftOtherSheetsForStructuralOp } from "./workbookRefs";

const withFormula = (body: string) => setCellRaw(createEmptySheet(), 0, 0, body);
const a1 = (s: { cells: string[][] }) => s.cells[0][0];

describe("a row inserted in one sheet, seen from another", () => {
  it("moves a reference that names the edited sheet", () => {
    const tabs = [
      { name: "Data", sheet: withFormula("=1") },
      { name: "Main", sheet: withFormula("=Data!A5") },
    ];
    const out = shiftOtherSheetsForStructuralOp(tabs, "Data", "row", 0, 1);
    expect(a1(out[1])).toBe("=Data!A6");
  });

  it("leaves a bare reference alone, because it names the sheet it is written on", () => {
    // The half that is easy to miss: inserting a row in Data must not move Main's own `A5`.
    const tabs = [
      { name: "Data", sheet: withFormula("=1") },
      { name: "Main", sheet: withFormula("=A5") },
    ];
    expect(a1(shiftOtherSheetsForStructuralOp(tabs, "Data", "row", 0, 1)[1])).toBe("=A5");
  });

  it("leaves a reference to a third sheet alone", () => {
    const tabs = [
      { name: "Data", sheet: withFormula("=1") },
      { name: "Main", sheet: withFormula("=Other!A5") },
    ];
    expect(a1(shiftOtherSheetsForStructuralOp(tabs, "Data", "row", 0, 1)[1])).toBe("=Other!A5");
  });

  it("does not touch the edited sheet, which has already adjusted itself", () => {
    // Shifting it here as well would move every reference on it twice.
    const tabs = [{ name: "Data", sheet: withFormula("=A5") }];
    expect(a1(shiftOtherSheetsForStructuralOp(tabs, "Data", "row", 0, 1)[0])).toBe("=A5");
  });

  it("breaks a cross-sheet reference to a deleted row, and drops the now-pointless name", () => {
    const tabs = [
      { name: "Data", sheet: withFormula("=1") },
      { name: "Main", sheet: withFormula("=Data!A5") },
    ];
    expect(a1(shiftOtherSheetsForStructuralOp(tabs, "Data", "row", 4, -1)[1])).toBe("=#REF!");
  });

  it("grows a cross-sheet range when a row lands inside it", () => {
    const tabs = [
      { name: "Data", sheet: withFormula("=1") },
      { name: "Main", sheet: withFormula("=SUM(Data!A1:A10)") },
    ];
    expect(a1(shiftOtherSheetsForStructuralOp(tabs, "Data", "row", 5, 1)[1])).toBe("=SUM(Data!A1:A11)");
  });

  it("matches the sheet name however either side capitalised it", () => {
    const tabs = [
      { name: "Data", sheet: withFormula("=1") },
      { name: "Main", sheet: withFormula("=dATA!A5") },
    ];
    expect(a1(shiftOtherSheetsForStructuralOp(tabs, "data", "row", 0, 1)[1])).toBe("=dATA!A6");
  });

  it("keeps the object identity of a sheet it did not change", () => {
    // The compute cache and the undo history are both keyed on identity; a fresh copy per keystroke
    // would quietly turn every incremental recalc into a full one.
    const untouched = withFormula("=A5");
    const tabs = [{ name: "Data", sheet: withFormula("=1") }, { name: "Main", sheet: untouched }];
    expect(shiftOtherSheetsForStructuralOp(tabs, "Data", "row", 0, 1)[1]).toBe(untouched);
  });
});

describe("renaming a sheet", () => {
  it("rewrites the formulas that named it", () => {
    const tabs = [{ name: "Main", sheet: withFormula("=Sheet2!A1 + SUM(Sheet2!B1:B3)") }];
    expect(a1(renameSheetInFormulas(tabs, "Sheet2", "ยอดขาย")[0])).toBe("=ยอดขาย!A1+SUM(ยอดขาย!B1:B3)");
  });

  it("quotes the new name when it needs quoting", () => {
    const tabs = [{ name: "Main", sheet: withFormula("=Sheet2!A1") }];
    expect(a1(renameSheetInFormulas(tabs, "Sheet2", "ยอดขาย Q1")[0])).toBe("='ยอดขาย Q1'!A1");
  });

  it("drops the quotes again when the new name does not need them", () => {
    const tabs = [{ name: "Main", sheet: withFormula("='ยอดขาย Q1'!A1") }];
    expect(a1(renameSheetInFormulas(tabs, "ยอดขาย Q1", "Q1")[0])).toBe("=Q1!A1");
  });

  it("leaves other sheets' names and bare references alone", () => {
    const tabs = [{ name: "Main", sheet: withFormula("=Sheet2!A1 + Sheet3!A1 + A1") }];
    expect(a1(renameSheetInFormulas(tabs, "Sheet2", "X")[0])).toBe("=X!A1+Sheet3!A1+A1");
  });

  it("does not mistake a sheet name inside a string for a reference", () => {
    const tabs = [{ name: "Main", sheet: withFormula('=IF(A1="Sheet2","yes","no")') }];
    expect(a1(renameSheetInFormulas(tabs, "Sheet2", "X")[0])).toBe('=IF(A1="Sheet2","yes","no")');
  });
});
