import { describe, expect, it } from "vitest";
import { axisLabel, chartMarks, fitBox, PAD } from "./chartGeometry";
import { chartDataFrom } from "./charts";
import { FormulaValue } from "./formulaEngine/types";

const full = (rows: number, cols: number) => ({ startRow: 0, startCol: 0, endRow: rows - 1, endCol: cols - 1 });
const sales: FormulaValue[][] = [
  ["สาขา", "ม.ค.", "ก.พ."],
  ["กรุงเทพ", 120, 205],
  ["เชียงใหม่", 45, 88],
  ["ภูเก็ต", 150, 163],
];
const data = chartDataFrom(sales, full(4, 3));
const box = { w: 320, h: 190 };

describe("axis labels", () => {
  it("shortens big numbers so they don't collide", () => {
    expect(axisLabel(1_250_000)).toBe("1.3M");
    expect(axisLabel(2_400)).toBe("2.4k");
    expect(axisLabel(42)).toBe("42");
  });
});

describe("the box a chart is drawn into", () => {
  it("never shrinks below the axis furniture, which would invert the plot area", () => {
    const tiny = fitBox(10, 10);
    expect(tiny.w).toBeGreaterThan(PAD.left + PAD.right);
    expect(tiny.h).toBeGreaterThan(PAD.top + PAD.bottom);
  });
});

describe("bar marks", () => {
  const marks = chartMarks("bar", data, box);

  it("draws one bar per value per series", () => {
    expect(marks.filter((m) => m.shape === "rect")).toHaveLength(6);
  });

  it("keeps every bar inside the plot area", () => {
    for (const m of marks) {
      if (m.shape !== "rect") continue;
      expect(m.x).toBeGreaterThanOrEqual(PAD.left - 0.001);
      expect(m.x + m.w).toBeLessThanOrEqual(box.w - PAD.right + 0.001);
      expect(m.y + m.h).toBeLessThanOrEqual(box.h - PAD.bottom + 0.001);
    }
  });

  it("gives the two series different colours", () => {
    const fills = new Set(marks.filter((m) => m.shape === "rect").map((m) => (m.shape === "rect" ? m.fill : "")));
    expect(fills.size).toBe(2);
  });

  it("draws a taller bar for a bigger number", () => {
    const rects = marks.filter((m) => m.shape === "rect");
    const bangkok = rects[0];
    const chiangmai = rects[1];
    if (bangkok.shape !== "rect" || chiangmai.shape !== "rect") throw new Error("expected rects");
    expect(bangkok.h).toBeGreaterThan(chiangmai.h);
  });
});

describe("line marks", () => {
  it("breaks the line where a value is missing instead of running through the gap", () => {
    const gappy = chartDataFrom([["x", 1], ["y", "ปิด"], ["z", 3]], full(3, 2));
    const runs = chartMarks("line", gappy, box).filter((m) => m.shape === "polyline");
    // Two points either side of a gap leave no run of two at all — an invented straight line
    // through the hole is exactly what must not appear.
    expect(runs).toHaveLength(0);
  });

  it("draws one run through consecutive values", () => {
    const runs = chartMarks("line", data, box).filter((m) => m.shape === "polyline");
    expect(runs).toHaveLength(2);
  });
});

describe("pie marks", () => {
  it("draws one wedge per category of the chosen series", () => {
    expect(chartMarks("pie", data, box).filter((m) => m.shape === "path")).toHaveLength(3);
  });

  it("draws the second series when asked, with different proportions", () => {
    const first = chartMarks("pie", data, box, 0).find((m) => m.shape === "path");
    const second = chartMarks("pie", data, box, 1).find((m) => m.shape === "path");
    expect(first?.shape === "path" && second?.shape === "path" && first.d !== second.d).toBe(true);
  });

  it("draws a whole circle when one category is everything, since an arc would collapse", () => {
    const single = chartDataFrom([["สาขา", "ยอด"], ["กรุงเทพ", 10]], full(2, 2));
    const marks = chartMarks("pie", single, box);
    expect(marks.filter((m) => m.shape === "circle")).toHaveLength(1);
    expect(marks.filter((m) => m.shape === "path")).toHaveLength(0);
  });

  it("draws nothing at all when the series has no positive value", () => {
    const zeros = chartDataFrom([["สาขา", "ยอด"], ["ก", 0], ["ข", 0]], full(3, 2));
    expect(chartMarks("pie", zeros, box)).toEqual([]);
  });
});

describe("labels thinning out", () => {
  const many = chartDataFrom(
    [["ชื่อ", "ค่า"], ...Array.from({ length: 20 }, (_, i) => [`รายการ${i}`, i + 1])] as FormulaValue[][],
    full(21, 2)
  );

  it("drops labels on a narrow chart rather than overlapping them", () => {
    const narrow = chartMarks("bar", many, fitBox(200, 160)).filter((m) => m.shape === "text");
    const wide = chartMarks("bar", many, fitBox(900, 160)).filter((m) => m.shape === "text");
    expect(wide.length).toBeGreaterThan(narrow.length);
  });

  it("shows every label when there is room for them all", () => {
    const labels = chartMarks("bar", data, fitBox(600, 200))
      .filter((m) => m.shape === "text")
      .map((m) => (m.shape === "text" ? m.text : ""));
    for (const name of ["กรุงเทพ", "ภูเก็ต"]) expect(labels).toContain(name);
  });
});
