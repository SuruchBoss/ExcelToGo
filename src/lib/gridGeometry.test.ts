import { describe, expect, it } from "vitest";
import { autoChartFrame, COL_WIDTH, columnLeft, contentSize, ROW_HEADER_WIDTH, ROW_HEIGHT, rowTop } from "./gridGeometry";
import { createEmptySheet, SheetModel } from "./sheet";

function sheet(rows = 10, cols = 5): SheetModel {
  return createEmptySheet(rows, cols);
}

describe("where a column sits", () => {
  it("starts after the row header, not at zero", () => {
    expect(columnLeft(sheet(), 0)).toBe(ROW_HEADER_WIDTH);
  });

  it("adds up the columns before it", () => {
    expect(columnLeft(sheet(), 3)).toBe(ROW_HEADER_WIDTH + COL_WIDTH * 3);
  });

  it("uses the widths an imported file brought with it", () => {
    const s = sheet();
    s.colWidths = [200, undefined, 60];
    expect(columnLeft(s, 3)).toBe(ROW_HEADER_WIDTH + 200 + COL_WIDTH + 60);
  });
});

describe("where a row sits", () => {
  it("starts below the column header", () => {
    expect(rowTop(sheet(), 0)).toBe(ROW_HEIGHT);
  });

  it("uses per-row heights from an import", () => {
    const s = sheet();
    s.rowHeights = [48];
    expect(rowTop(s, 2)).toBe(ROW_HEIGHT + 48 + ROW_HEIGHT);
  });

  it("skips rows a filter has hidden, which take up no height on screen", () => {
    // Charts are placed in the same pixels the table renders into; counting a hidden row's height
    // would leave every chart below a filtered row floating clear of its own data.
    expect(rowTop(sheet(), 4, new Set([1, 2]))).toBe(ROW_HEIGHT + ROW_HEIGHT * 2);
  });
});

describe("the scrollable canvas", () => {
  it("spans every column and row", () => {
    expect(contentSize(sheet(4, 3))).toEqual({
      width: ROW_HEADER_WIDTH + COL_WIDTH * 3,
      height: ROW_HEIGHT + ROW_HEIGHT * 4,
    });
  });

  it("shrinks as a filter hides rows", () => {
    expect(contentSize(sheet(4, 3), new Set([0, 1])).height).toBe(ROW_HEIGHT + ROW_HEIGHT * 2);
  });
});

describe("where a new chart lands", () => {
  it("sits just under the range it reads, aligned to its left edge", () => {
    const f = autoChartFrame(sheet(), { startRow: 1, startCol: 2, endRow: 3, endCol: 4 });
    expect(f.x).toBe(columnLeft(sheet(), 2));
    expect(f.y).toBeGreaterThan(rowTop(sheet(), 3));
    expect(f.w).toBeGreaterThan(0);
  });

  it("steps clear of a chart already sitting where it would have landed", () => {
    // Two charts from one range, stacked exactly, read as one chart that changed type.
    const s = sheet();
    const range = { startRow: 1, startCol: 2, endRow: 3, endCol: 4 };
    const first = autoChartFrame(s, range);
    s.charts = [{ id: "c1", kind: "bar", range, frame: first }];
    const second = autoChartFrame(s, range);
    expect(second.x).toBeGreaterThan(first.x);
    expect(second.y).toBeGreaterThan(first.y);
  });

  it("steps clear again for a third chart on the same range", () => {
    const s = sheet();
    const range = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
    const first = autoChartFrame(s, range);
    s.charts = [{ id: "c1", kind: "bar", range, frame: first }];
    const second = autoChartFrame(s, range);
    s.charts.push({ id: "c2", kind: "line", range, frame: second });
    const third = autoChartFrame(s, range);
    expect(new Set([first.x, second.x, third.x]).size).toBe(3);
  });

  it("stays within the sheet when the range ends on the last row", () => {
    const s = sheet(4, 3);
    const f = autoChartFrame(s, { startRow: 0, startCol: 0, endRow: 3, endCol: 2 });
    expect(f.y).toBe(contentSize(s).height + 8);
  });
});
