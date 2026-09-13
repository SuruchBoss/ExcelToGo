/**
 * Charts drawn from a range of the sheet.
 *
 * A chart stores only *which cells* it reads, never the numbers themselves, so it redraws from
 * the computed values on every render — edit a cell and the bar moves with it. That also keeps a
 * chart honest after a sort, an insert, or a formula change, none of which it has to know about.
 *
 * The drawing itself is plain SVG in the component: a bar, line or pie chart is a few dozen lines
 * of geometry, and a charting library would add far more weight to the bundle than it saves here.
 */
import { FormulaValue } from "./formulaEngine/types";
import { SheetRange, shiftPoint, shiftRange } from "./sheetRange";

export type ChartKind = "bar" | "line" | "pie";

export interface ChartSpec {
  id: string;
  kind: ChartKind;
  range: SheetRange;
  /** Optional, user-supplied. The range's own header is used when this is empty. */
  title?: string;
  /**
   * Where the chart sits on the grid: pinned to a cell, plus an offset inside it. A chart tied to
   * pixels alone stayed put when a column was inserted to its left and ended up covering different
   * data than it was placed beside; pinned to a cell it moves with the sheet the way its range
   * already did.
   */
  anchor?: ChartAnchor;
  /**
   * The old pixel-only position, read once and converted. Charts saved before the anchor existed
   * still load; the first drag replaces it.
   * @deprecated superseded by `anchor`
   */
  frame?: ChartFrame;
  /**
   * Which series a pie draws, since a pie can only show one. Bar and line ignore it.
   * Defaults to the first.
   */
  seriesIndex?: number;
}

/** A chart's top-left corner as a cell plus an offset inside it, with its size in pixels. */
export interface ChartAnchor {
  row: number;
  col: number;
  /** Pixels right of, and below, that cell's top-left corner. */
  dx: number;
  dy: number;
  w: number;
  h: number;
}

/** A chart's rectangle on the grid: top-left corner and size, all in content pixels. */
export interface ChartFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Small enough to tuck beside a column of figures, large enough that the axis labels still read.
 * Below this a chart stops being a chart and becomes a coloured smudge, so a resize stops here
 * rather than letting someone shrink one to nothing by accident and lose track of it.
 */
export const MIN_CHART_W = 180;
export const MIN_CHART_H = 130;

export const DEFAULT_CHART_W = 300;
export const DEFAULT_CHART_H = 200;

export function moveFrame(frame: ChartFrame, dx: number, dy: number): ChartFrame {
  return { ...frame, x: frame.x + dx, y: frame.y + dy };
}

/** Resizes from the bottom-right corner, which is the only handle: the top-left stays put. */
export function resizeFrame(frame: ChartFrame, dx: number, dy: number): ChartFrame {
  return { ...frame, w: Math.max(MIN_CHART_W, frame.w + dx), h: Math.max(MIN_CHART_H, frame.h + dy) };
}

/**
 * Keeps a frame inside the sheet.
 *
 * Without this a chart can be dragged past the last row into space the grid never scrolls to, and
 * it is simply gone — there is no way back to something you cannot reach. The minimum size wins
 * over the sheet's own size, so a chart on a tiny sheet overhangs rather than collapsing.
 */
export function clampFrame(frame: ChartFrame, canvas: { width: number; height: number }): ChartFrame {
  const w = Math.min(Math.max(frame.w, MIN_CHART_W), Math.max(MIN_CHART_W, canvas.width));
  const h = Math.min(Math.max(frame.h, MIN_CHART_H), Math.max(MIN_CHART_H, canvas.height));
  return {
    w,
    h,
    x: Math.min(Math.max(0, frame.x), Math.max(0, canvas.width - w)),
    y: Math.min(Math.max(0, frame.y), Math.max(0, canvas.height - h)),
  };
}

export interface ChartSeries {
  name: string;
  /** One value per label; a cell that holds no number becomes null and leaves a gap. */
  points: (number | null)[];
}

export interface ChartData {
  labels: string[];
  series: ChartSeries[];
  /** True when the range's first row was read as series names rather than data. */
  usedHeaderRow: boolean;
  /** True when the first column was read as category labels rather than a series. */
  usedLabelColumn: boolean;
}

function asNumber(v: FormulaValue): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function isTextual(v: FormulaValue): boolean {
  return typeof v === "string" && v.trim() !== "";
}

function cellText(v: FormulaValue): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** Reads the block of cells a chart covers out of the computed grid. */
function block(values: FormulaValue[][], range: SheetRange): FormulaValue[][] {
  const out: FormulaValue[][] = [];
  for (let r = range.startRow; r <= range.endRow; r++) {
    const row: FormulaValue[] = [];
    for (let c = range.startCol; c <= range.endCol; c++) row.push(values[r]?.[c] ?? null);
    out.push(row);
  }
  return out;
}

/**
 * Turns a range into labels and series, working out for itself whether the first row holds series
 * names and whether the first column holds category labels.
 *
 * A first row counts as series names only where the columns that carry numbers hold text in it
 * instead — so a label column's first entry never turns an ordinary row of data into a header.
 * Getting that backwards drops a row of real data out of the chart without saying so.
 */
export function chartDataFrom(values: FormulaValue[][], range: SheetRange): ChartData {
  const cells = block(values, range);
  if (cells.length === 0 || cells[0].length === 0) {
    return { labels: [], series: [], usedHeaderRow: false, usedLabelColumn: false };
  }

  // Which columns actually carry numbers decides everything else. Asking only "is anything in the
  // first row text?" reads a label column's first entry as a header and silently drops a row of
  // real data — so the test is whether the *numeric* columns hold text up top instead of a number.
  const below = cells.slice(1);
  const numericCols: number[] = [];
  for (let c = 0; c < Math.max(...cells.map((row) => row.length)); c++) {
    if (below.some((row) => asNumber(row[c]) !== null)) numericCols.push(c);
  }
  const usedHeaderRow =
    cells.length > 1 &&
    numericCols.length > 0 &&
    numericCols.every((c) => asNumber(cells[0][c]) === null) &&
    numericCols.some((c) => isTextual(cells[0][c]));
  const body = usedHeaderRow ? cells.slice(1) : cells;
  if (body.length === 0) return { labels: [], series: [], usedHeaderRow, usedLabelColumn: false };

  // A first column of text next to numeric columns is what people label their rows with.
  const usedLabelColumn =
    body[0].length > 1 &&
    body.some((row) => isTextual(row[0])) &&
    body.some((row) => row.slice(1).some((v) => asNumber(v) !== null));

  const labels = body.map((row, i) => (usedLabelColumn ? cellText(row[0]) : String(i + 1)));
  const firstDataCol = usedLabelColumn ? 1 : 0;
  const colCount = Math.max(...body.map((row) => row.length));

  const series: ChartSeries[] = [];
  for (let c = firstDataCol; c < colCount; c++) {
    const points = body.map((row) => asNumber(row[c]));
    // A column with nothing numeric in it is not a series; plotting it would draw a flat nothing.
    if (points.every((p) => p === null)) continue;
    const headerName = usedHeaderRow ? cellText(cells[0][c]).trim() : "";
    series.push({ name: headerName || `${c - firstDataCol + 1}`, points });
  }

  // Labels name points; with nothing to plot they name nothing, so an empty range stays empty
  // rather than reporting a row of phantom categories.
  return { labels: series.length > 0 ? labels : [], series, usedHeaderRow, usedLabelColumn };
}

/** The vertical span a chart's axis should cover, always including zero so bar lengths are honest. */
export function valueExtent(series: ChartSeries[]): { min: number; max: number } {
  const nums = series.flatMap((s) => s.points.filter((p): p is number => p !== null));
  if (nums.length === 0) return { min: 0, max: 1 };
  const min = Math.min(0, ...nums);
  const max = Math.max(0, ...nums);
  // A range of zero (every value identical, or all zero) would divide by nothing when scaling.
  return max === min ? { min, max: min + 1 } : { min, max };
}

/**
 * The series a pie should draw, clamped to one that exists.
 *
 * A chart keeps its chosen series while the sheet changes underneath it, so the column it pointed
 * at can disappear. Falling back to the first draws something honest instead of an empty circle.
 */
export function pieSeriesIndex(data: ChartData, seriesIndex = 0): number {
  return seriesIndex >= 0 && seriesIndex < data.series.length ? seriesIndex : 0;
}

/** Colours for successive series, reused from the app's palette so charts match the rest of it. */
export const CHART_COLORS = ["#059669", "#2563eb", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];

export function seriesColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/**
 * What a chart's legend should name — and it is not the same thing for every kind.
 *
 * A bar or line chart colours one line per series, so the legend names the series, and only earns
 * its space when there is more than one to tell apart. A pie draws a single series coloured slice
 * by slice, so its legend names the *categories*: listing the series there would label four slices
 * with two quarter names and quietly mislead anyone reading it.
 */
export function legendEntries(kind: ChartKind, data: ChartData, seriesIndex = 0): { label: string; color: string }[] {
  if (kind !== "pie") {
    return data.series.length > 1 ? data.series.map((s, i) => ({ label: s.name, color: seriesColor(i) })) : [];
  }
  const first = data.series[pieSeriesIndex(data, seriesIndex)];
  if (!first) return [];
  // Only the slices actually drawn: the pie skips anything that isn't a positive number, and a
  // legend entry with no wedge beside it is worse than none.
  return data.labels
    .map((label, i) => ({ label, color: seriesColor(i), point: first.points[i] }))
    .filter((e) => e.point !== null && e.point > 0)
    .map(({ label, color }) => ({ label, color }));
}

/** Moves chart ranges to follow an inserted or deleted row/column, dropping any whose range the
 *  deletion removed entirely. */
export function shiftCharts(
  charts: ChartSpec[] | undefined,
  axis: "row" | "col",
  index: number,
  delta: 1 | -1
): ChartSpec[] | undefined {
  if (!charts || charts.length === 0) return charts;
  const out: ChartSpec[] = [];
  for (const chart of charts) {
    const range = shiftRange(chart.range, axis, index, delta);
    if (!range) continue;
    // The anchor follows the same edit as the range, which is the whole point of anchoring to a
    // cell: insert a column to the left and the chart travels with the data instead of staying put
    // over whatever slid underneath it.
    const anchor = chart.anchor
      ? axis === "row"
        ? { ...chart.anchor, row: shiftPoint(chart.anchor.row, index, delta) }
        : { ...chart.anchor, col: shiftPoint(chart.anchor.col, index, delta) }
      : undefined;
    out.push({ ...chart, range, anchor });
  }
  return out.length > 0 ? out : undefined;
}
