// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { computeSheet, createEmptySheet, setCellRaw, type SheetModel } from "./sheet";
import { insertRowBefore, deleteRow } from "./sheet";
import {
  listNames,
  nameProblem,
  nameScope,
  refForSelection,
  refToNode,
  shiftNames,
  substituteNames,
  withName,
  withoutName,
  type NameTable,
} from "./namedRanges";
import { parseFormula } from "./formulaEngine/parser";
import { shiftFormulaRefs } from "./formulaEngine/shift";
import { clearFormulaCache, compileFormula } from "./formulaEngine/formulaProgram";

const table = (): NameTable => withName(undefined, "ยอดขาย", "B1:B4");

/** A sheet with a column of numbers and a name over it. */
function named(ref = "B1:B4"): SheetModel {
  let sheet = createEmptySheet(10, 5);
  for (let r = 0; r < 4; r++) sheet = setCellRaw(sheet, r, 1, String((r + 1) * 10));
  return { ...sheet, names: withName(undefined, "ยอดขาย", ref) };
}

describe("what may be a name", () => {
  it("takes a Thai word, which is the whole point of the feature here", () => {
    expect(nameProblem("ยอดขาย", undefined)).toBeNull();
    expect(nameProblem("ยอดขาย_Q1", undefined)).toBeNull();
  });

  it("refuses one that is also an address", () => {
    // `=SUM(B2)` has to mean one thing. Excel refuses these for the same reason.
    expect(nameProblem("B2", undefined)).toBe("looksLikeRef");
    expect(nameProblem("A1:B2", undefined)).toBe("looksLikeRef");
  });

  it("refuses anything the tokenizer could not read back as one word", () => {
    // A name with a space in it would be two tokens, so it would exist and be unusable.
    for (const bad of ["ยอด ขาย", "1sales", "sales!", "ยอด-ขาย"]) {
      expect(nameProblem(bad, undefined)).toBe("badChars");
    }
    expect(nameProblem("   ", undefined)).toBe("empty");
  });

  it("refuses a function name and the words Excel reserves", () => {
    expect(nameProblem("SUM", undefined)).toBe("reserved");
    expect(nameProblem("true", undefined)).toBe("reserved");
    expect(nameProblem("R", undefined)).toBe("reserved");
  });

  it("refuses a repeat, whatever case it is typed in", () => {
    expect(nameProblem("ยอดขาย", table())).toBe("taken");
    expect(nameProblem("SALES", withName(undefined, "sales", "A1"))).toBe("taken");
  });

  it("lets a name keep its own spelling while its target moves", () => {
    // Renaming in place: the name being replaced is not a collision with itself.
    expect(nameProblem("ยอดขาย", table(), "ยอดขาย")).toBeNull();
  });

  it("stops at Excel's 255 characters", () => {
    expect(nameProblem("ก".repeat(256), undefined)).toBe("tooLong");
    expect(nameProblem("ก".repeat(255), undefined)).toBeNull();
  });
});

describe("a name inside a formula", () => {
  it("compiles to the rectangle it stands for, precedents and all", () => {
    clearFormulaCache();
    const program = compileFormula("SUM(ยอดขาย)", nameScope(table()));
    expect(program.ranges).toEqual([{ startRow: 0, startCol: 1, endRow: 3, endCol: 1 }]);
  });

  it("is computed as the range, not as text", () => {
    const sheet = setCellRaw(named(), 5, 0, "=SUM(ยอดขาย)");
    expect(computeSheet(sheet).values[5][0]).toBe(100);
  });

  it("reads #NAME? when nothing defines it", () => {
    // It used to evaluate to the string "ยอดขาย", so `=SUM(ยอดขาย)` was 0 and looked like an
    // empty column rather than a mistake.
    const sheet = setCellRaw(createEmptySheet(10, 5), 0, 0, "=SUM(ยอดขาย)");
    expect(String(computeSheet(sheet).values[0][0])).toBe("#NAME?");
  });

  it("recomputes when the name is pointed somewhere else", () => {
    // The formula text has not changed, so nothing cell-level has; this is the case the compile
    // cache and the incremental diff would both sail past.
    const before = setCellRaw(named("B1:B2"), 5, 0, "=SUM(ยอดขาย)");
    expect(computeSheet(before).values[5][0]).toBe(30);
    const after = { ...before, names: withName(undefined, "ยอดขาย", "B1:B4") };
    expect(computeSheet(after).values[5][0]).toBe(100);
  });

  it("matches the name however it was capitalised", () => {
    const sheet = setCellRaw(
      { ...createEmptySheet(10, 5), names: withName(undefined, "Sales", "B1") },
      0,
      0,
      "=sales+1"
    );
    const withValue = setCellRaw(sheet, 0, 1, "41");
    expect(computeSheet(withValue).values[0][0]).toBe(42);
  });

  it("leaves a name alone where a cell reference would move", () => {
    // Filling `=SUM(ยอดขาย)` down a column must not turn it into `=SUM(ยอดขาย2)`. Names are
    // absolute in Excel, and here that falls out of only CELL and RANGE tokens being rewritten.
    expect(shiftFormulaRefs("SUM(ยอดขาย)+A1", 3, 0)).toBe("SUM(ยอดขาย)+A4");
  });
});

describe("substitution", () => {
  const scope = nameScope(table())!;

  it("replaces the name wherever it sits in the tree", () => {
    const ast = substituteNames(parseFormula("IF(SUM(ยอดขาย)>0,ยอดขาย,0)"), scope);
    expect(JSON.stringify(ast)).not.toContain("ยอดขาย");
  });

  it("gives the same object back when there is nothing to replace", () => {
    // Identity matters: the compiled tree is cached and compared by reference downstream.
    const ast = parseFormula("A1+B2");
    expect(substituteNames(ast, scope)).toBe(ast);
  });

  it("leaves a name nothing defines standing, to become #NAME?", () => {
    expect(substituteNames(parseFormula("ไม่มีชื่อนี้"), scope)).toEqual({ type: "name", name: "ไม่มีชื่อนี้" });
  });
});

describe("names move with the rows under them", () => {
  it("grows when a row is inserted inside the range", () => {
    expect(shiftNames(table(), "row", 2, 1)?.["ยอดขาย"].ref).toBe("B1:B5");
  });

  it("slides down when a row is inserted above it", () => {
    expect(shiftNames(withName(undefined, "ก", "B5:B9"), "row", 0, 1)?.["ก"].ref).toBe("B6:B10");
  });

  it("shrinks when a row inside it goes", () => {
    expect(shiftNames(table(), "row", 1, -1)?.["ยอดขาย"].ref).toBe("B1:B3");
  });

  it("drops a name whose whole target was deleted", () => {
    // A name pointing at wreckage is worse than no name: `#NAME?` at least says what is wrong.
    expect(shiftNames(withName(undefined, "ก", "B2"), "row", 1, -1)).toBeUndefined();
  });

  it("gives the same table back when nothing moved", () => {
    const before = withName(undefined, "ก", "B2:B4");
    expect(shiftNames(before, "row", 9, 1)).toBe(before);
  });

  it("moves through a real row insert on the sheet", () => {
    const sheet = named();
    const shifted = shiftNames(sheet.names, "row", 0, 1);
    expect(shifted?.["ยอดขาย"].ref).toBe("B2:B5");
    // And the sheet's own helper agrees about where the numbers went.
    expect(insertRowBefore(sheet, 0).cells[1][1]).toBe("10");
    expect(deleteRow(sheet, 0).cells[0][1]).toBe("20");
  });
});

describe("the table itself", () => {
  it("drops to nothing when its last name goes, rather than an empty object", () => {
    // An empty table would still key the formula cache differently from no table at all.
    expect(withoutName(table(), "ยอดขาย")).toBeUndefined();
    expect(nameScope({})).toBeUndefined();
  });

  it("writes a selection as an absolute, qualified reference", () => {
    // Bare rather than qualified: a prefix would make it a cross-sheet reference, which needs a
    // workbook resolver that half of `computeSheet`'s callers do not pass.
    expect(refForSelection({ startRow: 1, startCol: 1, endRow: 4, endCol: 1 })).toBe("$B$2:$B$5");
    expect(refForSelection({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 })).toBe("$A$1");
  });

  it("reads a qualified target back as a node that names the sheet", () => {
    expect(refToNode("ข้อมูล!$B$2:$B$5")).toEqual({
      type: "range",
      startRow: 1,
      startCol: 1,
      endRow: 4,
      endCol: 1,
      sheet: "ข้อมูล",
    });
    expect(refToNode("ไม่ใช่ตำแหน่ง")).toBeUndefined();
  });

  it("lists names by what was typed, not by the key they are stored under", () => {
    const many = withName(withName(undefined, "ข", "A1"), "ก", "A2");
    expect(listNames(many).map((n) => n.label)).toEqual(["ก", "ข"]);
  });
});
