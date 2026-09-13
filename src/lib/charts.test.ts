import { describe, expect, it } from "vitest";
import {
  chartDataFrom,
  ChartSpec,
  clampFrame,
  legendEntries,
  pieSeriesIndex,
  MIN_CHART_H,
  MIN_CHART_W,
  moveFrame,
  resizeFrame,
  seriesColor,
  shiftCharts,
  valueExtent,
} from "./charts";
import { FormulaValue } from "./formulaEngine/types";
import { cloneSheet, createEmptySheet, deleteRow, insertColumnBefore, SheetModel } from "./sheet";

const full = (rows: number, cols: number) => ({ startRow: 0, startCol: 0, endRow: rows - 1, endCol: cols - 1 });

const sales: FormulaValue[][] = [
  ["สาขา", "ม.ค.", "ก.พ."],
  ["กรุงเทพ", 120, 205],
  ["เชียงใหม่", 45, 88],
  ["ภูเก็ต", 150, 163],
];

describe("reading a range into a chart", () => {
  it("takes the first row as series names and the first column as labels", () => {
    const d = chartDataFrom(sales, full(4, 3));
    expect(d.usedHeaderRow).toBe(true);
    expect(d.usedLabelColumn).toBe(true);
    expect(d.labels).toEqual(["กรุงเทพ", "เชียงใหม่", "ภูเก็ต"]);
    expect(d.series.map((s) => s.name)).toEqual(["ม.ค.", "ก.พ."]);
    expect(d.series[0].points).toEqual([120, 45, 150]);
    expect(d.series[1].points).toEqual([205, 88, 163]);
  });

  it("treats a range of bare numbers as one series numbered from 1", () => {
    const d = chartDataFrom([[10], [20], [30]], full(3, 1));
    expect(d.usedHeaderRow).toBe(false);
    expect(d.usedLabelColumn).toBe(false);
    expect(d.labels).toEqual(["1", "2", "3"]);
    expect(d.series).toHaveLength(1);
    expect(d.series[0].points).toEqual([10, 20, 30]);
  });

  it("keeps a text first row as data when there is nothing numeric under it", () => {
    // Header detection has to look at what is underneath; a lone row of text is not a header of
    // anything, and treating it as one would leave a chart with no series at all.
    const d = chartDataFrom([["a", "b"]], full(1, 2));
    expect(d.usedHeaderRow).toBe(false);
  });

  it("leaves a gap where a cell holds no number, rather than plotting zero", () => {
    const d = chartDataFrom([["x", 1], ["y", "ไม่มีข้อมูล"], ["z", 3]], full(3, 2));
    expect(d.series[0].points).toEqual([1, null, 3]);
  });

  it("ignores a column with nothing numeric in it", () => {
    const withNote = [
      ["สาขา", "ยอด", "หมายเหตุ"],
      ["กรุงเทพ", 120, "ปกติ"],
      ["ภูเก็ต", 150, "ปกติ"],
    ];
    const d = chartDataFrom(withNote, full(3, 3));
    expect(d.series.map((s) => s.name)).toEqual(["ยอด"]);
  });

  it("reads a single column of numbers under a header as one named series", () => {
    const d = chartDataFrom([["ยอดขาย"], [10], [20]], full(3, 1));
    expect(d.usedHeaderRow).toBe(true);
    expect(d.usedLabelColumn).toBe(false);
    expect(d.series[0].name).toBe("ยอดขาย");
    expect(d.series[0].points).toEqual([10, 20]);
  });

  it("survives an empty range without throwing", () => {
    const d = chartDataFrom([], full(1, 1));
    expect(d.series).toEqual([]);
    expect(d.labels).toEqual([]);
  });

  it("reads only the cells inside the range", () => {
    const d = chartDataFrom(sales, { startRow: 1, startCol: 1, endRow: 2, endCol: 1 });
    expect(d.series[0].points).toEqual([120, 45]);
    expect(d.labels).toEqual(["1", "2"]);
  });
});

describe("the value axis", () => {
  it("always includes zero, so a bar's length means what it looks like", () => {
    expect(valueExtent([{ name: "a", points: [80, 100] }])).toEqual({ min: 0, max: 100 });
  });

  it("extends below zero when the data does", () => {
    expect(valueExtent([{ name: "a", points: [-30, 50] }])).toEqual({ min: -30, max: 50 });
  });

  it("never returns a zero-width span, which would divide by nothing when scaling", () => {
    const flat = valueExtent([{ name: "a", points: [0, 0] }]);
    expect(flat.max).toBeGreaterThan(flat.min);
  });

  it("handles a series with no numbers at all", () => {
    const none = valueExtent([{ name: "a", points: [null, null] }]);
    expect(none.max).toBeGreaterThan(none.min);
  });
});

describe("colours", () => {
  it("gives each series its own colour and wraps around rather than running out", () => {
    expect(seriesColor(0)).not.toBe(seriesColor(1));
    expect(seriesColor(0)).toBe(seriesColor(6));
  });
});

describe("charts following edits to the sheet", () => {
  const chart: ChartSpec = { id: "c1", kind: "bar", range: { startRow: 1, startCol: 0, endRow: 4, endCol: 2 } };

  it("slides a range that sits below an inserted column", () => {
    const out = shiftCharts([chart], "col", 0, 1)!;
    expect(out[0].range.startCol).toBe(1);
    expect(out[0].range.endCol).toBe(3);
  });

  it("shrinks the range when a row inside it is deleted", () => {
    const out = shiftCharts([chart], "row", 2, -1)!;
    expect(out[0].range).toEqual({ startRow: 1, startCol: 0, endRow: 3, endCol: 2 });
  });

  it("drops a chart whose only row was deleted", () => {
    const single: ChartSpec = { id: "c", kind: "pie", range: { startRow: 2, startCol: 0, endRow: 2, endCol: 3 } };
    expect(shiftCharts([single], "row", 2, -1)).toBeUndefined();
  });

  it("keeps a chart that shrinks to a single cell", () => {
    const two: ChartSpec = { id: "c", kind: "line", range: { startRow: 1, startCol: 1, endRow: 2, endCol: 1 } };
    const out = shiftCharts([two], "row", 2, -1)!;
    expect(out).toHaveLength(1);
  });
});

describe("wired into the sheet", () => {
  function sheetWithChart(): SheetModel {
    const sheet = createEmptySheet(6, 4);
    sheet.charts = [{ id: "c1", kind: "bar", range: { startRow: 1, startCol: 0, endRow: 4, endCol: 2 } }];
    return sheet;
  }

  it("moves a chart's range when a row above it is deleted", () => {
    const out = deleteRow(sheetWithChart(), 0);
    expect(out.charts?.[0].range).toEqual({ startRow: 0, startCol: 0, endRow: 3, endCol: 2 });
  });

  it("moves a chart's range when a column is inserted before it", () => {
    const out = insertColumnBefore(sheetWithChart(), 0);
    expect(out.charts?.[0].range.startCol).toBe(1);
  });

  it("cloning a sheet doesn't let one copy's charts leak into the other", () => {
    const original = sheetWithChart();
    const copy = cloneSheet(original);
    copy.charts!.push({ id: "c2", kind: "pie", range: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 } });
    expect(original.charts).toHaveLength(1);
  });
});

describe("a chart's frame on the grid", () => {
  const frame = { x: 100, y: 80, w: 300, h: 200 };
  const canvas = { width: 1000, height: 600 };

  it("moves by the distance dragged, leaving the size alone", () => {
    expect(moveFrame(frame, 25, -30)).toEqual({ x: 125, y: 50, w: 300, h: 200 });
  });

  it("resizes from the bottom-right, so the top-left corner stays put", () => {
    const out = resizeFrame(frame, 40, 60);
    expect(out).toEqual({ x: 100, y: 80, w: 340, h: 260 });
  });

  it("stops shrinking at a size that can still be read", () => {
    const out = resizeFrame(frame, -9999, -9999);
    expect(out.w).toBe(MIN_CHART_W);
    expect(out.h).toBe(MIN_CHART_H);
  });

  it("keeps a chart dragged past the last row inside the sheet", () => {
    // Without this it lands where the grid never scrolls to and there is no way back to it.
    const out = clampFrame({ ...frame, x: 5000, y: 5000 }, canvas);
    expect(out.x).toBe(canvas.width - frame.w);
    expect(out.y).toBe(canvas.height - frame.h);
  });

  it("keeps a chart dragged off the top-left inside the sheet", () => {
    const out = clampFrame({ ...frame, x: -400, y: -400 }, canvas);
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
  });

  it("caps a size larger than the sheet itself", () => {
    const out = clampFrame({ x: 0, y: 0, w: 9999, h: 9999 }, canvas);
    expect(out).toEqual({ x: 0, y: 0, w: canvas.width, h: canvas.height });
  });

  it("lets a chart overhang a sheet too small to hold it, rather than collapsing it", () => {
    const tiny = { width: 60, height: 40 };
    const out = clampFrame(frame, tiny);
    expect(out).toEqual({ x: 0, y: 0, w: MIN_CHART_W, h: MIN_CHART_H });
  });

});

describe("a chart's anchor following edits to the sheet", () => {
  const anchor = { row: 5, col: 3, dx: 4, dy: 8, w: 300, h: 200 };
  const pinned: ChartSpec = { id: "c", kind: "bar", range: { startRow: 2, startCol: 0, endRow: 4, endCol: 2 }, anchor };

  it("travels with its cell when a column is inserted to its left", () => {
    // The whole reason for anchoring: pinned to pixels the chart stayed put and ended up covering
    // different data than it was placed beside.
    expect(shiftCharts([pinned], "col", 0, 1)![0].anchor).toEqual({ ...anchor, col: 4 });
  });

  it("stays where it is when a column is inserted to its right", () => {
    expect(shiftCharts([pinned], "col", 9, 1)![0].anchor).toEqual(anchor);
  });

  it("moves up when a row above it is deleted", () => {
    expect(shiftCharts([pinned], "row", 0, -1)![0].anchor).toEqual({ ...anchor, row: 4 });
  });

  it("keeps its offset inside the cell, which is what stops it drifting over repeated edits", () => {
    let charts = [pinned];
    for (let i = 0; i < 5; i++) charts = shiftCharts(charts, "col", 0, 1)!;
    expect(charts[0].anchor).toMatchObject({ dx: 4, dy: 8 });
  });

  it("stays on the column the deletion landed on rather than being thrown away", () => {
    expect(shiftCharts([pinned], "col", 3, -1)![0].anchor).toEqual({ ...anchor, col: 3 });
  });

  it("leaves a chart still carrying only the old pixel position alone", () => {
    const oldFrame = { x: 100, y: 80, w: 300, h: 200 };
    const legacy: ChartSpec = { id: "c", kind: "bar", range: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 }, frame: oldFrame };
    const out = shiftCharts([legacy], "col", 0, 1)!;
    expect(out[0].frame).toEqual(oldFrame);
    expect(out[0].anchor).toBeUndefined();
  });
});

describe("which series a pie draws", () => {
  const data = chartDataFrom(sales, full(4, 3));

  it("defaults to the first", () => {
    expect(pieSeriesIndex(data)).toBe(0);
  });

  it("uses the one chosen", () => {
    expect(pieSeriesIndex(data, 1)).toBe(1);
    expect(legendEntries("pie", data, 1).map((e) => e.label)).toEqual(["กรุงเทพ", "เชียงใหม่", "ภูเก็ต"]);
  });

  it("falls back to the first when the chosen series no longer exists", () => {
    // A chart keeps its choice while the sheet changes underneath it, so the column it pointed at
    // can go away; drawing the first series is better than drawing an empty circle.
    expect(pieSeriesIndex(data, 7)).toBe(0);
    expect(pieSeriesIndex(data, -1)).toBe(0);
  });

  it("leaves out a category the chosen series has no slice for", () => {
    const gappy = chartDataFrom(
      [["สาขา", "ม.ค.", "ก.พ."], ["กรุงเทพ", 10, 5], ["เชียงใหม่", 20, "ปิด"]],
      full(3, 3)
    );
    expect(legendEntries("pie", gappy, 1).map((e) => e.label)).toEqual(["กรุงเทพ"]);
  });
});

describe("what the legend names", () => {
  const data = chartDataFrom(sales, full(4, 3));

  it("names the series on a bar chart", () => {
    expect(legendEntries("bar", data).map((e) => e.label)).toEqual(["ม.ค.", "ก.พ."]);
  });

  it("stays out of the way when there is only one series to tell apart", () => {
    const one = chartDataFrom([["ยอด"], [10], [20]], full(3, 1));
    expect(legendEntries("line", one)).toEqual([]);
  });

  it("names the slices on a pie, not the series", () => {
    // The pie draws one series coloured slice by slice; naming the series would label three
    // branches with two month names.
    expect(legendEntries("pie", data).map((e) => e.label)).toEqual(["กรุงเทพ", "เชียงใหม่", "ภูเก็ต"]);
  });

  it("colours each pie entry like the slice it stands for", () => {
    const entries = legendEntries("pie", data);
    expect(entries[0].color).toBe(seriesColor(0));
    expect(entries[2].color).toBe(seriesColor(2));
  });

  it("leaves out a category the pie never draws", () => {
    const withGap = chartDataFrom(
      [["สาขา", "ยอด"], ["กรุงเทพ", 10], ["เชียงใหม่", "ยังไม่ส่ง"], ["ภูเก็ต", 30]],
      full(4, 2)
    );
    expect(legendEntries("pie", withGap).map((e) => e.label)).toEqual(["กรุงเทพ", "ภูเก็ต"]);
  });
});
