import { describe, expect, it } from "vitest";
import { chartDataFrom, ChartSpec, seriesColor, shiftCharts, valueExtent } from "./charts";
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
