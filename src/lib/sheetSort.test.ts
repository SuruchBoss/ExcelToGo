// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { createEmptySheet, computeSheet, setCellRaw } from "./sheet";
import { detectSortRange, sortRange } from "./sheetSort";
import { singleCellSelection } from "@/types/sheet-ui";

function sheetFromRows(rows: (string | number)[][]) {
  let sheet = createEmptySheet(rows.length + 2, Math.max(...rows.map((r) => r.length)) + 2);
  rows.forEach((row, r) => {
    row.forEach((value, c) => {
      sheet = setCellRaw(sheet, r, c, String(value));
    });
  });
  return sheet;
}

describe("detectSortRange", () => {
  it("uses the selection as-is when it already spans multiple rows", () => {
    const sheet = sheetFromRows([
      ["Name", "Price"],
      ["Coffee", "45"],
      ["Bread", "30"],
    ]);
    const computed = computeSheet(sheet);
    const selection = { startRow: 1, startCol: 0, endRow: 2, endCol: 1 };
    expect(detectSortRange(sheet, computed, selection, 1)).toEqual({
      startRow: 1,
      endRow: 2,
      startCol: 0,
      endCol: 1,
    });
  });

  it("expands a single-cell selection to the surrounding contiguous block", () => {
    const sheet = sheetFromRows([
      ["Name", "Price"],
      ["Coffee", "45"],
      ["Bread", "30"],
      ["Milk", "25"],
    ]);
    const computed = computeSheet(sheet);
    // Anchor on the numeric "Price" column (col 1) — the header-exclusion heuristic only
    // fires for a column that's mostly numeric under a textual header.
    const selection = singleCellSelection(2, 1);
    const range = detectSortRange(sheet, computed, selection, 2);
    expect(range.startCol).toBe(0);
    expect(range.endCol).toBe(sheet.cols - 1);
    expect(range.endRow).toBe(3);
    // Row 0 ("Name"/"Price") is a textual header over mostly-numeric data, so it's excluded.
    expect(range.startRow).toBe(1);
  });

  it("stops the block at a blank row", () => {
    const sheet = sheetFromRows([
      ["Name", "Price"],
      ["Coffee", "45"],
      ["", ""],
      ["Bread", "30"],
    ]);
    const computed = computeSheet(sheet);
    const range = detectSortRange(sheet, computed, singleCellSelection(1, 0), 1);
    expect(range.endRow).toBe(1);
  });
});

describe("the header stays on top, whichever way the sort runs (#49)", () => {
  const sortFromCell = (rows: (string | number)[][], row: number, col: number, ascending: boolean, bold = false) => {
    let sheet = sheetFromRows(rows);
    if (bold) sheet = { ...sheet, formats: sheet.formats.map((r, i) => (i === 0 ? r.map(() => ({ bold: true })) : r)) };
    const computed = computeSheet(sheet);
    const range = detectSortRange(sheet, computed, singleCellSelection(row, col), row);
    return sortRange(sheet, computed, range, col, ascending).cells.slice(0, rows.length).map((r) => r.slice(0, rows[0].length));
  };

  it("QA's table: descending on the text column keeps Name/Score on row 1", () => {
    const rows = [["Name", "Score"], ["a", "3"], ["b", "1"], ["c", "2"]];
    expect(sortFromCell(rows, 1, 0, false)).toEqual([["Name", "Score"], ["c", "2"], ["b", "1"], ["a", "3"]]);
  });

  it("and ascending on the same column answers the same way, not by code-point luck", () => {
    const rows = [["name", "Score"], ["b", "1"], ["a", "3"], ["c", "2"]];
    // Lowercase "name" sorts after "c", so the old rule would have buried it at the bottom.
    expect(sortFromCell(rows, 1, 0, true)[0]).toEqual(["name", "Score"]);
  });

  it("a label over a column nobody has filled in yet is a header", () => {
    const rows = [["Name", "City"], ["amy", ""], ["bob", ""], ["cat", ""]];
    expect(sortFromCell(rows, 1, 0, false)).toEqual([["Name", "City"], ["cat", ""], ["bob", ""], ["amy", ""]]);
  });

  it("a bold top row over plain rows is a header, even when every cell is a word", () => {
    const rows = [["Name", "City"], ["amy", "Nan"], ["bob", "Loei"], ["cat", "Trat"]];
    expect(sortFromCell(rows, 1, 0, false, true)[0]).toEqual(["Name", "City"]);
  });

  it("a top row with a number in it is data, however it is drawn", () => {
    const rows = [["2024", "Q1"], ["2023", "Q2"], ["2025", "Q3"]];
    expect(sortFromCell(rows, 0, 0, true, true).map((r) => r[0])).toEqual(["2023", "2024", "2025"]);
  });

  it("a plain list of words has nothing to tell its first row apart, so it is sorted with the rest", () => {
    const rows = [["pear"], ["apple"], ["fig"]];
    expect(sortFromCell(rows, 0, 0, true).map((r) => r[0])).toEqual(["apple", "fig", "pear"]);
  });
});

describe("sortRange", () => {
  it("reorders rows ascending by the sort column's computed value", () => {
    const sheet = sheetFromRows([
      ["Coffee", "45"],
      ["Bread", "30"],
      ["Milk", "25"],
    ]);
    const computed = computeSheet(sheet);
    const sorted = sortRange(sheet, computed, { startRow: 0, endRow: 2, startCol: 0, endCol: 1 }, 1, true);
    expect(sorted.cells.slice(0, 3).map((r) => r[0])).toEqual(["Milk", "Bread", "Coffee"]);
  });

  it("reorders rows descending", () => {
    const sheet = sheetFromRows([
      ["Coffee", "45"],
      ["Bread", "30"],
      ["Milk", "25"],
    ]);
    const computed = computeSheet(sheet);
    const sorted = sortRange(sheet, computed, { startRow: 0, endRow: 2, startCol: 0, endCol: 1 }, 1, false);
    expect(sorted.cells.slice(0, 3).map((r) => r[0])).toEqual(["Coffee", "Bread", "Milk"]);
  });

  it("always sorts blank cells to the end regardless of direction", () => {
    const sheet = sheetFromRows([
      ["Coffee", "45"],
      ["NoPrice", ""],
      ["Milk", "25"],
    ]);
    const computed = computeSheet(sheet);
    const ascending = sortRange(sheet, computed, { startRow: 0, endRow: 2, startCol: 0, endCol: 1 }, 1, true);
    expect(ascending.cells[2][0]).toBe("NoPrice");
    const descending = sortRange(sheet, computed, { startRow: 0, endRow: 2, startCol: 0, endCol: 1 }, 1, false);
    expect(descending.cells[2][0]).toBe("NoPrice");
  });

  it("only reorders columns within the range's column span", () => {
    const sheet = sheetFromRows([
      ["Coffee", "45", "keep-A"],
      ["Bread", "30", "keep-B"],
      ["Milk", "25", "keep-C"],
    ]);
    const computed = computeSheet(sheet);
    // Sort only columns 0-1 by column 1; column 2 must stay in its original row order.
    const sorted = sortRange(sheet, computed, { startRow: 0, endRow: 2, startCol: 0, endCol: 1 }, 1, true);
    expect(sorted.cells.slice(0, 3).map((r) => r[2])).toEqual(["keep-A", "keep-B", "keep-C"]);
  });
});
