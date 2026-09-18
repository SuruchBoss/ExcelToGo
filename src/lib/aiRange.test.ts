import { describe, expect, it } from "vitest";
import { autoSumRange, headerRow } from "./aiRange";

/** A grid drawn as text, so the case under test is readable in the test. */
function grid(rows: string[][]) {
  const bounds = { rows: rows.length, cols: Math.max(...rows.map((r) => r.length)) };
  const valueAt = (r: number, c: number) => rows[r]?.[c] ?? "";
  return { valueAt, bounds };
}

describe("the range the assistant is told about", () => {
  it("takes the whole column when the cursor is standing in it", () => {
    // This app's own sample sheet, column E: the header, nine numbers, then a blank. A cursor on
    // E2 has exactly one filled cell above it — the header — so looking only upwards answered
    // SUM(E1): the total of the word "รวม". Measured on the public demo.
    const { valueAt, bounds } = grid([["รวม"], ["1170"], ["1080"], ["495"], ["660"], [""], ["7495"]]);
    expect(autoSumRange(valueAt, bounds, { row: 1, col: 0 })).toEqual({ startRow: 1, endRow: 4 });
  });

  it("stops at the blank rather than swallowing the grand total below it", () => {
    const { valueAt, bounds } = grid([["รวม"], ["1170"], ["1080"], [""], ["7495"]]);
    expect(autoSumRange(valueAt, bounds, { row: 2, col: 0 })).toEqual({ startRow: 1, endRow: 2 });
  });

  it("reads the same column from a cursor anywhere in it", () => {
    const { valueAt, bounds } = grid([["รวม"], ["10"], ["20"], ["30"], [""]]);
    for (const row of [1, 2, 3]) {
      expect(autoSumRange(valueAt, bounds, { row, col: 0 }), `from row ${row}`).toEqual({ startRow: 1, endRow: 3 });
    }
  });

  it("takes the filled run above the cursor, the way AutoSum does", () => {
    // The bug this exists for: the cursor on E2 of a sales column made the answer =SUM(E2).
    const { valueAt, bounds } = grid([["10"], ["20"], ["30"], [""]]);
    expect(autoSumRange(valueAt, bounds, { row: 3, col: 0 })).toEqual({ startRow: 0, endRow: 2 });
  });

  it("stops at a blank, rather than sweeping the whole column", () => {
    const { valueAt, bounds } = grid([["99"], [""], ["10"], ["20"], [""]]);
    expect(autoSumRange(valueAt, bounds, { row: 4, col: 0 })).toEqual({ startRow: 2, endRow: 3 });
  });

  it("drops a text header sitting on top of numbers", () => {
    const { valueAt, bounds } = grid([["ยอดขาย"], ["10"], ["20"], [""]]);
    expect(autoSumRange(valueAt, bounds, { row: 3, col: 0 })).toEqual({ startRow: 1, endRow: 2 });
  });

  it("keeps a text first cell when the rest is text too", () => {
    // Not a header — a column of words. COUNTA over it is a real answer; SUM over it is 0.
    const { valueAt, bounds } = grid([["กาแฟ"], ["ชา"], ["น้ำ"], [""]]);
    expect(autoSumRange(valueAt, bounds, { row: 3, col: 0 })).toEqual({ startRow: 0, endRow: 2 });
  });

  it("reads downwards when the cursor is on the header instead", () => {
    const { valueAt, bounds } = grid([["ยอดขาย"], ["10"], ["20"]]);
    expect(autoSumRange(valueAt, bounds, { row: 0, col: 0 })).toEqual({ startRow: 1, endRow: 2 });
  });

  it("prefers what is above when there is something on both sides", () => {
    const { valueAt, bounds } = grid([["10"], ["20"], [""], ["30"]]);
    // Cursor on row 2, with 10/20 above and 30 below: AutoSum totals what you have already typed.
    expect(autoSumRange(valueAt, bounds, { row: 2, col: 0 })).toEqual({ startRow: 0, endRow: 1 });
  });

  it("gives back nothing when the cursor stands alone", () => {
    const { valueAt, bounds } = grid([[""], [""], [""]]);
    expect(autoSumRange(valueAt, bounds, { row: 1, col: 0 })).toBeNull();
  });

  it("gives back nothing for a column that does not exist", () => {
    const { valueAt, bounds } = grid([["10"], ["20"]]);
    expect(autoSumRange(valueAt, bounds, { row: 1, col: 9 })).toBeNull();
  });

  it("reads the column the cursor is in, not the first one", () => {
    const { valueAt, bounds } = grid([
      ["ก", "ราคา"],
      ["ข", "10"],
      ["ค", "20"],
      ["", ""],
    ]);
    expect(autoSumRange(valueAt, bounds, { row: 3, col: 1 })).toEqual({ startRow: 1, endRow: 2 });
  });

  it("counts a number written with thousands separators as a number", () => {
    const { valueAt, bounds } = grid([["ยอด"], ["1,250"], ["2,400"], [""]]);
    expect(autoSumRange(valueAt, bounds, { row: 3, col: 0 })).toEqual({ startRow: 1, endRow: 2 });
  });
});

describe("the headers sent along with the question", () => {
  it("reads the first row and skips the gaps", () => {
    const { valueAt, bounds } = grid([
      ["sku", "", "price"],
      ["A1", "x", "10"],
    ]);
    expect(headerRow(valueAt, bounds)).toEqual(["sku", "price"]);
  });

  it("stops at the limit rather than sending a thousand columns", () => {
    const wide = Array.from({ length: 200 }, (_, i) => `h${i}`);
    const { valueAt, bounds } = grid([wide]);
    expect(headerRow(valueAt, bounds, 5)).toHaveLength(5);
  });

  it("has nothing to say about an empty sheet", () => {
    expect(headerRow(() => "", { rows: 0, cols: 0 })).toEqual([]);
  });
});
