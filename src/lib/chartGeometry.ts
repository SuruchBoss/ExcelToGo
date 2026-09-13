/**
 * A chart reduced to plain shapes, before anything draws it.
 *
 * There are two renderers now: the React component on the grid, and a standalone SVG string used to
 * put a picture of the chart into an .xlsx or a PDF. Exporting can't reuse the mounted component —
 * a chart on a sheet the user isn't looking at was never rendered — so without this the geometry
 * would exist twice and the exported chart would quietly stop matching the one on screen.
 *
 * The marks are deliberately dumb: numbers and colours, no SVG, no JSX. That also makes the
 * geometry testable on its own, which it wasn't while it lived inside a component.
 */
import { ChartData, ChartKind, pieSeriesIndex, seriesColor, valueExtent } from "./charts";

export interface ChartBox {
  w: number;
  h: number;
}

export type ChartMark =
  | { shape: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number }
  | { shape: "rect"; x: number; y: number; w: number; h: number; fill: string; rx: number }
  | { shape: "text"; x: number; y: number; anchor: "start" | "middle" | "end"; size: number; fill: string; text: string }
  | { shape: "polyline"; points: string; stroke: string; width: number }
  | { shape: "circle"; cx: number; cy: number; r: number; fill: string }
  | { shape: "path"; d: string; fill: string; stroke?: string; strokeWidth?: number };

export const PAD = { top: 10, right: 10, bottom: 30, left: 40 };
/** Roughly what a truncated category name occupies at this font size. */
const MIN_LABEL_PX = 44;
const GRID_COLOR = "#e4e4e7";
const ZERO_COLOR = "#a1a1aa";
const TEXT_COLOR = "#71717a";

/** Formats an axis number compactly — a full 1,250,000 would collide with its neighbours. */
export function axisLabel(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(v * 100) / 100);
}

/** Never smaller than the axis furniture, or the plot area comes out negative and the drawing
 *  folds inside out. */
export function fitBox(width: number, height: number): ChartBox {
  return {
    w: Math.max(width, PAD.left + PAD.right + 40),
    h: Math.max(height, PAD.top + PAD.bottom + 40),
  };
}

export function chartMarks(kind: ChartKind, data: ChartData, box: ChartBox, seriesIndex = 0): ChartMark[] {
  if (data.series.length === 0 || data.labels.length === 0) return [];
  return kind === "pie" ? pieMarks(data, box, seriesIndex) : axesMarks(kind, data, box);
}

function axesMarks(kind: ChartKind, data: ChartData, box: ChartBox): ChartMark[] {
  const { w: W, h: H } = box;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const { min, max } = valueExtent(data.series);
  const y = (v: number) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;
  const slot = plotW / data.labels.length;
  const zeroY = y(0);
  const marks: ChartMark[] = [];

  for (const v of [min, min + (max - min) / 2, max]) {
    marks.push({ shape: "line", x1: PAD.left, x2: W - PAD.right, y1: y(v), y2: y(v), stroke: GRID_COLOR, width: 1 });
    marks.push({ shape: "text", x: PAD.left - 4, y: y(v) + 3, anchor: "end", size: 9, fill: TEXT_COLOR, text: axisLabel(v) });
  }
  // Zero is drawn darker than the other gridlines: with negative values it is the baseline bars
  // hang from, and without it the chart reads as if everything were positive.
  if (min < 0) {
    marks.push({ shape: "line", x1: PAD.left, x2: W - PAD.right, y1: zeroY, y2: zeroY, stroke: ZERO_COLOR, width: 1 });
  }

  // Labels thin out rather than overlap once the slots get narrower than a name needs — and a chart
  // dragged wider earns back the ones it had to drop.
  const labelStep = Math.max(1, Math.ceil(MIN_LABEL_PX / slot));
  data.labels.forEach((label, i) => {
    if (i % labelStep !== 0) return;
    marks.push({
      shape: "text",
      x: PAD.left + slot * (i + 0.5),
      y: H - 14,
      anchor: "middle",
      size: 9,
      fill: TEXT_COLOR,
      text: label.length > 9 ? label.slice(0, 8) + "…" : label,
    });
  });

  if (kind === "bar") {
    const barW = (slot * 0.7) / data.series.length;
    data.series.forEach((s, si) => {
      s.points.forEach((p, i) => {
        if (p === null) return;
        marks.push({
          shape: "rect",
          x: PAD.left + slot * (i + 0.15) + barW * si,
          y: Math.min(y(p), zeroY),
          w: barW,
          h: Math.max(1, Math.abs(zeroY - y(p))),
          fill: seriesColor(si),
          rx: 1,
        });
      });
    });
    return marks;
  }

  data.series.forEach((s, si) => {
    // A gap in the data breaks the line rather than drawing a straight run through it, which would
    // invent readings that were never there.
    let current: string[] = [];
    const flush = () => {
      if (current.length > 1) {
        marks.push({ shape: "polyline", points: current.join(" "), stroke: seriesColor(si), width: 2 });
      }
      current = [];
    };
    s.points.forEach((p, i) => {
      if (p === null) {
        flush();
        return;
      }
      current.push(`${PAD.left + slot * (i + 0.5)},${y(p)}`);
    });
    flush();
    s.points.forEach((p, i) => {
      if (p === null) return;
      marks.push({ shape: "circle", cx: PAD.left + slot * (i + 0.5), cy: y(p), r: 2.5, fill: seriesColor(si) });
    });
  });
  return marks;
}

function pieMarks(data: ChartData, box: ChartBox, seriesIndex: number): ChartMark[] {
  const series = data.series[pieSeriesIndex(data, seriesIndex)];
  const points = series.points.map((p) => (p === null ? 0 : Math.max(0, p)));
  const total = points.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];

  const cx = box.w / 2;
  const cy = box.h / 2;
  // A pie has no axis to label, so it takes the whole box rather than the plot area a bar chart
  // leaves behind — it is the shape that benefits most from being dragged bigger.
  const r = Math.min(box.w, box.h) / 2 - 6;

  const marks: ChartMark[] = [];
  let cursor = -Math.PI / 2;
  for (let i = 0; i < points.length; i++) {
    const sweep = (points[i] / total) * Math.PI * 2;
    if (points[i] > 0) {
      // A slice covering everything cannot be drawn as an arc — its start and end points are the
      // same, so the path collapses to nothing. It is a full circle instead.
      if (sweep >= Math.PI * 2 - 1e-9) {
        marks.push({ shape: "circle", cx, cy, r, fill: seriesColor(i) });
      } else {
        const to = cursor + sweep;
        const x1 = cx + r * Math.cos(cursor);
        const y1 = cy + r * Math.sin(cursor);
        const x2 = cx + r * Math.cos(to);
        const y2 = cy + r * Math.sin(to);
        marks.push({
          shape: "path",
          d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`,
          fill: seriesColor(i),
          stroke: "#ffffff",
          strokeWidth: 1,
        });
      }
    }
    cursor += sweep;
  }
  return marks;
}
