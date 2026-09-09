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
    expect(detectSortRange(sheet, computed, selection, 1, 0)).toEqual({
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
    const range = detectSortRange(sheet, computed, selection, 2, 1);
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
    const range = detectSortRange(sheet, computed, singleCellSelection(1, 0), 1, 0);
    expect(range.endRow).toBe(1);
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
