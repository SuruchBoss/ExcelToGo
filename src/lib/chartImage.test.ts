import { describe, expect, it } from "vitest";
import { chartToSvg } from "./chartImage";
import { chartDataFrom } from "./charts";
import { FormulaValue } from "./formulaEngine/types";

const full = (rows: number, cols: number) => ({ startRow: 0, startCol: 0, endRow: rows - 1, endCol: cols - 1 });
const sales: FormulaValue[][] = [
  ["สาขา", "ม.ค.", "ก.พ."],
  ["กรุงเทพ", 120, 205],
  ["เชียงใหม่", 45, 88],
];
const data = chartDataFrom(sales, full(3, 3));

describe("a chart as a standalone picture", () => {
  it("is a complete SVG document, not a fragment", () => {
    const pic = chartToSvg("bar", data, 300, 200)!;
    expect(pic.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(pic.svg.endsWith("</svg>")).toBe(true);
  });

  it("paints its own white background, since a file has no page behind it", () => {
    expect(chartToSvg("bar", data, 300, 200)!.svg).toContain('fill="#ffffff"');
  });

  it("carries the legend, which on screen is HTML beside the drawing", () => {
    // A chart in a file whose colours name nothing is the thing this repo already fixed once.
    const pic = chartToSvg("bar", data, 300, 200)!;
    expect(pic.svg).toContain("ม.ค.");
    expect(pic.svg).toContain("ก.พ.");
  });

  it("names the categories on a pie, not the series", () => {
    const pic = chartToSvg("pie", data, 300, 200)!;
    expect(pic.svg).toContain("กรุงเทพ");
    expect(pic.svg).not.toContain("ม.ค.");
  });

  it("follows the chosen series on a pie", () => {
    const first = chartToSvg("pie", data, 300, 200, 0)!;
    const second = chartToSvg("pie", data, 300, 200, 1)!;
    expect(first.svg).not.toBe(second.svg);
  });

  it("fits the legend inside the size it was asked for rather than growing past it", () => {
    // The caller places the picture at the chart's on-screen size; a picture that came back taller
    // than requested would overlap whatever is under it in the .xlsx or run off the PDF page.
    const withLegend = chartToSvg("bar", data, 300, 200)!;
    const oneSeries = chartToSvg("bar", chartDataFrom([["ยอด"], [10], [20]], full(3, 1)), 300, 200)!;
    expect(withLegend.height).toBe(200);
    expect(oneSeries.height).toBe(200);
  });

  it("puts the legend below the drawing, inside the picture, not across it", () => {
    const pic = chartToSvg("bar", data, 300, 200)!;
    const swatchTops = [...pic.svg.matchAll(/<rect [^>]*y="([\d.]+)"[^>]*rx="1.5"/g)].map((m) => Number(m[1]));
    const barBottoms = [...pic.svg.matchAll(/<rect [^>]*y="([\d.]+)"[^>]*height="([\d.]+)"[^>]*rx="1"\/>/g)].map(
      (m) => Number(m[1]) + Number(m[2])
    );
    expect(swatchTops.length).toBeGreaterThan(0);
    expect(barBottoms.length).toBeGreaterThan(0);
    expect(Math.min(...swatchTops)).toBeGreaterThan(Math.max(...barBottoms));
    expect(Math.max(...swatchTops)).toBeLessThan(pic.height);
  });

  it("escapes characters that would otherwise break the XML", () => {
    const risky = chartDataFrom([['<a & b>', "ยอด"], ['"x" & <y>', 5]], full(2, 2));
    const pic = chartToSvg("bar", risky, 300, 200);
    expect(pic!.svg).not.toContain("<a & b>");
    expect(pic!.svg).toContain("&amp;");
  });

  it("is null when there is nothing to draw, so a caller skips it instead of writing a blank box", () => {
    expect(chartToSvg("bar", chartDataFrom([], full(1, 1)), 300, 200)).toBeNull();
    const zeros = chartDataFrom([["ก", 0], ["ข", 0]], full(2, 2));
    expect(chartToSvg("pie", zeros, 300, 200)).toBeNull();
  });

  it("reports the size it actually drew, which is what the caller places it at", () => {
    const pic = chartToSvg("bar", data, 300, 200)!;
    expect(pic.width).toBeGreaterThan(0);
    expect(pic.svg).toContain(`width="${pic.width}"`);
    expect(pic.svg).toContain(`height="${pic.height}"`);
  });
});
