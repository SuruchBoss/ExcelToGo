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
import { SheetRange, shiftRange } from "./sheetRange";

export type ChartKind = "bar" | "line" | "pie";

export interface ChartSpec {
  id: string;
  kind: ChartKind;
  range: SheetRange;
  /** Optional, user-supplied. The range's own header is used when this is empty. */
  title?: string;
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

/** Colours for successive series, reused from the app's palette so charts match the rest of it. */
export const CHART_COLORS = ["#059669", "#2563eb", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];

export function seriesColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
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
    if (range) out.push({ ...chart, range });
  }
  return out.length > 0 ? out : undefined;
}
