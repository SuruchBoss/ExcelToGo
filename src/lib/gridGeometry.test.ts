import { describe, expect, it } from "vitest";
import {
  anchorToFrame,
  autoChartAnchor,
  COL_WIDTH,
  columnLeft,
  contentSize,
  frameToAnchor,
  ROW_HEADER_WIDTH,
  ROW_HEIGHT,
  rowTop,
} from "./gridGeometry";
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
  it("pins to the cell just under the range it reads, on its left edge", () => {
    const a = autoChartAnchor(sheet(), { startRow: 1, startCol: 2, endRow: 3, endCol: 4 });
    expect(a.row).toBe(4);
    expect(a.col).toBe(2);
    expect(a.w).toBeGreaterThan(0);
  });

  it("steps clear of a chart already pinned where it would have landed", () => {
    // Two charts from one range, stacked exactly, read as one chart that changed type.
    const s = sheet();
    const range = { startRow: 1, startCol: 2, endRow: 3, endCol: 4 };
    const first = autoChartAnchor(s, range);
    s.charts = [{ id: "c1", kind: "bar", range, anchor: first }];
    const second = autoChartAnchor(s, range);
    expect(second.col === first.col && second.dy === first.dy).toBe(false);
  });

  it("steps clear again for a third chart on the same range", () => {
    const s = sheet();
    const range = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
    const first = autoChartAnchor(s, range);
    s.charts = [{ id: "c1", kind: "bar", range, anchor: first }];
    const second = autoChartAnchor(s, range);
    s.charts.push({ id: "c2", kind: "line", range, anchor: second });
    const third = autoChartAnchor(s, range);
    expect(new Set([first.col, second.col, third.col]).size).toBe(3);
  });

  it("stays on a real row when the range ends on the last one", () => {
    const s = sheet(4, 3);
    const a = autoChartAnchor(s, { startRow: 0, startCol: 0, endRow: 3, endCol: 2 });
    expect(a.row).toBe(3);
  });
});

describe("anchors and pixels convert both ways", () => {
  it("turns an anchor into the rectangle it describes", () => {
    const s = sheet();
    const f = anchorToFrame(s, { row: 2, col: 1, dx: 5, dy: 7, w: 300, h: 200 });
    expect(f.x).toBe(columnLeft(s, 1) + 5);
    expect(f.y).toBe(rowTop(s, 2) + 7);
    expect(f).toMatchObject({ w: 300, h: 200 });
  });

  it("comes back to the same anchor it started from", () => {
    const s = sheet();
    const before = { row: 3, col: 2, dx: 11, dy: 4, w: 320, h: 210 };
    expect(frameToAnchor(s, anchorToFrame(s, before), undefined)).toEqual(before);
  });

  it("round-trips through per-column widths from an imported file", () => {
    const s = sheet();
    s.colWidths = [200, undefined, 60];
    s.rowHeights = [48];
    const before = { row: 2, col: 2, dx: 3, dy: 9, w: 300, h: 200 };
    expect(frameToAnchor(s, anchorToFrame(s, before), undefined)).toEqual(before);
  });

  it("lands on the visible row when a filter hides the ones above", () => {
    const s = sheet();
    const hidden = new Set([0, 1]);
    const before = { row: 4, col: 0, dx: 0, dy: 6, w: 300, h: 200 };
    expect(frameToAnchor(s, anchorToFrame(s, before, hidden), hidden)).toEqual(before);
  });

  it("keeps a negative offset rather than snapping a chart dragged past the top-left to A1", () => {
    const s = sheet();
    const a = frameToAnchor(s, { x: 0, y: 0, w: 300, h: 200 });
    expect(a).toMatchObject({ row: 0, col: 0 });
    expect(a.dx).toBeLessThan(0);
    expect(a.dy).toBeLessThan(0);
  });

  it("puts a position past the last column in the last column, not off the end", () => {
    const s = sheet(10, 5);
    const a = frameToAnchor(s, { x: 99999, y: 99999, w: 300, h: 200 });
    expect(a.col).toBe(4);
    expect(a.row).toBe(9);
  });
});
