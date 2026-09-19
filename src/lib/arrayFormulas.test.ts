import { describe, expect, it } from "vitest";
import { computeSheet, createEmptySheet, setCellRaw, SheetModel } from "./sheet";
import { resetComputeCache } from "./sheetCompute";
import { packCell } from "./formulaEngine/formulaProgram";
import { calc } from "./formulaEngine/testUtils";

/**
 * Array formulas, end to end: the functions that answer with a shape, the operators that apply
 * across one, and the cells the answer lands in.
 *
 * Its own file rather than more cases in `functions.test.ts`, because the interesting half of this
 * feature is not in the engine at all — it is in `sheetCompute`, deciding where an answer goes and
 * refusing when it does not fit. Testing the function and the landing separately would leave the
 * part that actually broke untested, which is the seam between them.
 */

/** A sheet built cell by cell, the way the store builds one. */
function sheetOf(rows: string[][], height = rows.length + 3, width = 5): SheetModel {
  resetComputeCache();
  let sheet = createEmptySheet(height, width);
  rows.forEach((row, r) => row.forEach((raw, c) => (sheet = setCellRaw(sheet, r, c, raw))));
  return sheet;
}

const shown = (sheet: SheetModel, h: number, w: number) => {
  const { display } = computeSheet(sheet);
  return Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => display[r][c]));
};

describe("a formula whose answer is a shape", () => {
  it("fills the cells beside it", () => {
    const sheet = sheetOf([["=SEQUENCE(3,2)"]]);
    expect(shown(sheet, 3, 2)).toEqual([
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
  });

  it("marks every cell of the array as belonging to the one that made it", () => {
    const { spill } = computeSheet(sheetOf([["=SEQUENCE(3)"]]));
    const anchor = packCell(0, 0);
    expect(spill.get(anchor)).toBe(anchor);
    expect(spill.get(packCell(1, 0))).toBe(anchor);
    expect(spill.get(packCell(2, 0))).toBe(anchor);
    expect(spill.has(packCell(3, 0))).toBe(false);
  });

  it("leaves a sheet with no arrays carrying an empty map", () => {
    expect(computeSheet(sheetOf([["1", "2"], ["=A1+B1"]])).spill.size).toBe(0);
  });
});

describe("when the answer does not fit", () => {
  it("refuses rather than showing one ninth of it", () => {
    // The truncation this replaces was the dangerous behaviour: one value where nine were meant
    // looks exactly like a correct answer.
    const sheet = sheetOf([["=SEQUENCE(3)"], ["ขวางอยู่"]]);
    expect(shown(sheet, 2, 1)).toEqual([["#SPILL!"], ["ขวางอยู่"]]);
  });

  it("counts a formula in the way as in the way", () => {
    const sheet = sheetOf([["=SEQUENCE(3)"], ["=1+1"]]);
    expect(shown(sheet, 2, 1)[0][0]).toBe("#SPILL!");
  });

  it("refuses at the edge of the sheet", () => {
    resetComputeCache();
    let small = createEmptySheet(3, 2);
    small = setCellRaw(small, 0, 0, "=SEQUENCE(9)");
    expect(shown(small, 1, 1)).toEqual([["#SPILL!"]]);
  });

  it("writes nothing at all when it refuses", () => {
    // Half an array left on the sheet would be worse than none: the values would look like data.
    const sheet = sheetOf([["=SEQUENCE(4)"], [""], ["ขวาง"]]);
    const { display, spill } = computeSheet(sheet);
    expect(display[0][0]).toBe("#SPILL!");
    expect(display[1][0]).toBe("");
    expect(spill.size).toBe(0);
  });
});

describe("cells reading an array", () => {
  it("adds up the values the array put there, not the blanks that were there before", () => {
    // The ordering hazard this feature is built on: C2 and C3 are empty text and would read as
    // null if the sum ran before the array did. That the answer is 60 is the whole second pass.
    const sheet = sheetOf([
      ["1", "", "=A1:A3*10", "=SUM(C1:C3)"],
      ["2"],
      ["3"],
    ]);
    expect(shown(sheet, 1, 4)[0]).toEqual(["1", "", "10", "60"]);
  });

  it("works when the reader sits above the array in the sheet", () => {
    // Reading order is top-left to bottom-right, so this one is computed *before* the array it
    // depends on — the case the naive version got wrong.
    const sheet = sheetOf([
      ["=SUM(B2:B4)"],
      ["", "=SEQUENCE(3)"],
    ]);
    expect(shown(sheet, 1, 1)).toEqual([["6"]]);
  });
});

describe("operators applied across a range", () => {
  it("multiplies every cell, not just the first", () => {
    expect(calc("SUM(A1:A3*2)", [[1], [2], [3]])).toBe(12);
  });

  it("compares every cell", () => {
    const sheet = sheetOf([["1", "=A1:A3>2"], ["5"], ["9"]]);
    expect(shown(sheet, 3, 2).map((r) => r[1])).toEqual(["FALSE", "TRUE", "TRUE"]);
  });

  it("pairs two ranges of the same shape", () => {
    expect(calc("SUM(A1:A3*B1:B3)", [[1, 10], [2, 20], [3, 30]])).toBe(140);
  });

  it("refuses two ranges of different shapes rather than guessing", () => {
    // Excel would broadcast a row against a column into a rectangle. Doing that badly is worse
    // than not doing it, and #VALUE! says so.
    expect(String(calc("A1:A3*B1:B2", [[1, 7], [2, 8], [3, 9]]))).toBe("#VALUE!");
  });

  it("treats a one-cell range as the value it is", () => {
    expect(calc("A1:A1+1", [[41]])).toBe(42);
  });
});

describe("the array functions themselves", () => {
  it("TRANSPOSE turns rows into columns", () => {
    const sheet = sheetOf([["1", "2", "=TRANSPOSE(A1:B1)"]]);
    expect(shown(sheet, 2, 3).map((r) => r[2])).toEqual(["1", "2"]);
  });

  it("UNIQUE keeps the first of each, in the order they appear", () => {
    const sheet = sheetOf([["ก", "=UNIQUE(A1:A4)"], ["ข"], ["ก"], ["ค"]]);
    expect(shown(sheet, 3, 2).map((r) => r[1])).toEqual(["ก", "ข", "ค"]);
  });

  it("SORT orders ascending by default and descending when asked", () => {
    const up = sheetOf([["2", "=SORT(A1:A3)"], ["9"], ["5"]]);
    expect(shown(up, 3, 2).map((r) => r[1])).toEqual(["2", "5", "9"]);

    const down = sheetOf([["2", "=SORT(A1:A3,1,FALSE)"], ["9"], ["5"]]);
    expect(shown(down, 3, 2).map((r) => r[1])).toEqual(["9", "5", "2"]);
  });

  it("FILTER keeps the rows whose flag is true", () => {
    const sheet = sheetOf([["1", "ก", "=FILTER(A1:B3,A1:A3>2)"], ["5", "ข"], ["9", "ค"]]);
    const out = shown(sheet, 2, 4);
    expect([out[0][2], out[0][3]]).toEqual(["5", "ข"]);
    expect([out[1][2], out[1][3]]).toEqual(["9", "ค"]);
  });

  it("FILTER that matches nothing says so rather than returning an empty shape", () => {
    expect(String(calc('FILTER(A1:A3,A1:A3>100,"ไม่พบ")', [[1], [2], [3]]))).toBe("ไม่พบ");
    expect(String(calc("FILTER(A1:A3,A1:A3>100)", [[1], [2], [3]]))).toBe("#N/A");
  });

  it("FILTER refuses a flag column of the wrong height", () => {
    // Silently filtering by the wrong rows is the failure nobody would notice.
    expect(String(calc("FILTER(A1:A3,B1:B2)", [[1, 1], [2, 0], [3, 1]]))).toBe("#VALUE!");
  });

  it("SEQUENCE refuses a size that would take the tab down", () => {
    expect(String(calc("SEQUENCE(1000000)"))).toBe("#NUM!");
  });

  it("SEQUENCE counts across a row before moving down", () => {
    // Found by `check:mutants`: turning `r * w + c` into `r / w + c` passed the whole suite,
    // because every test of SEQUENCE asked for a single column, where the width never multiplies.
    const sheet = sheetOf([["=SEQUENCE(2,3)"]]);
    const out = shown(sheet, 2, 3);
    expect(out[0]).toEqual(["1", "2", "3"]);
    expect(out[1]).toEqual(["4", "5", "6"]);
  });

  it("walks by the step it was given, not by one", () => {
    // The third survivor from that run, and an equivalent mutant until a step other than 1 exists:
    // `(r * w + c) * step` and `(r * w + c) / step` are the same expression when step is 1, which
    // every test of SEQUENCE had left it as.
    const sheet = sheetOf([["=SEQUENCE(3,1,10,5)"]]);
    expect(shown(sheet, 3, 1).map((row) => row[0])).toEqual(["10", "15", "20"]);
  });

  it("allows exactly the size its guard allows, and refuses one more", () => {
    // The other survivor from the same run: `>` and `>=` were indistinguishable because nothing
    // asked for a size at the boundary. 250 × 200 is exactly the 50,000 the guard permits, and
    // answering at all is the difference; one more cell is #NUM!.
    expect(String(calc("SEQUENCE(250,200)"))).toBe("1");
    expect(String(calc("SEQUENCE(250,201)"))).toBe("#NUM!");
  });
});
