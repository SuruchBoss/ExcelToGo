/**
 * Where the grid's rows and columns sit, in pixels.
 *
 * The browser lays the table out, so almost nothing in the app needs these numbers. Charts do:
 * they float above the cells in the same coordinate space and have to be placed, dragged and
 * clamped without asking the DOM where anything is. The constants live here rather than inside the
 * grid component because the two have to agree exactly — a chart placed with a column width the
 * table doesn't use would drift further from its data the further right it sat.
 */
import { ChartAnchor, ChartFrame, ChartSpec, DEFAULT_CHART_H, DEFAULT_CHART_W } from "./charts";
import { SheetModel } from "./sheet";
import { SheetRange } from "./sheetRange";

export const ROW_HEADER_WIDTH = 48;
export const COL_WIDTH = 112;
export const ROW_HEIGHT = 32;

export function columnWidth(sheet: SheetModel, col: number): number {
  return sheet.colWidths?.[col] ?? COL_WIDTH;
}

export function rowHeight(sheet: SheetModel, row: number): number {
  return sheet.rowHeights?.[row] ?? ROW_HEIGHT;
}

/** The x of a column's left edge, measured from the grid's content origin — the row header included. */
export function columnLeft(sheet: SheetModel, col: number): number {
  let x = ROW_HEADER_WIDTH;
  for (let c = 0; c < Math.min(col, sheet.cols); c++) x += columnWidth(sheet, c);
  return x;
}

/**
 * The y of a row's top edge, below the column header.
 *
 * Rows a filter has hidden aren't rendered, so they take up no height; passing the hidden set is
 * what keeps a chart level with its data while a filter is on.
 */
export function rowTop(sheet: SheetModel, row: number, hiddenRows?: ReadonlySet<number>): number {
  let y = ROW_HEIGHT;
  for (let r = 0; r < Math.min(row, sheet.rows); r++) {
    if (hiddenRows?.has(r)) continue;
    y += rowHeight(sheet, r);
  }
  return y;
}

/** The full size of the scrollable content, which is what a chart may be dragged around inside. */
export function contentSize(sheet: SheetModel, hiddenRows?: ReadonlySet<number>): { width: number; height: number } {
  return { width: columnLeft(sheet, sheet.cols), height: rowTop(sheet, sheet.rows, hiddenRows) };
}

/** How far each chart steps clear of one already sitting where it would have landed. */
const CASCADE = 24;

/** The pixel rectangle an anchor describes, for drawing and for dragging. */
export function anchorToFrame(sheet: SheetModel, anchor: ChartAnchor, hiddenRows?: ReadonlySet<number>): ChartFrame {
  return {
    x: columnLeft(sheet, anchor.col) + anchor.dx,
    y: rowTop(sheet, anchor.row, hiddenRows) + anchor.dy,
    w: anchor.w,
    h: anchor.h,
  };
}

/**
 * The cell a pixel position falls in, and where that cell starts.
 *
 * Walked rather than divided because columns can carry their own widths from an imported file and
 * filtered rows take no height at all, so there is no single cell size to divide by. A position
 * past the last row or column lands on the last one rather than off the end — a finger dragged off
 * the edge of the sheet should select to the edge, not select nothing.
 */
export function cellAt(
  sheet: SheetModel,
  x: number,
  y: number,
  hiddenRows?: ReadonlySet<number>
): { row: number; col: number; left: number; top: number } {
  let col = 0;
  let left = ROW_HEADER_WIDTH;
  while (col < sheet.cols - 1 && left + columnWidth(sheet, col) <= x) {
    left += columnWidth(sheet, col);
    col++;
  }
  let row = 0;
  let top = ROW_HEIGHT;
  while (row < sheet.rows - 1) {
    const h = hiddenRows?.has(row) ? 0 : rowHeight(sheet, row);
    if (top + h > y) break;
    top += h;
    row++;
  }
  return { row, col, left, top };
}

export function frameToAnchor(sheet: SheetModel, frame: ChartFrame, hiddenRows?: ReadonlySet<number>): ChartAnchor {
  const { row, col, left, top } = cellAt(sheet, frame.x, frame.y, hiddenRows);
  // A chart dragged above the first row or left of the first column keeps a negative offset rather
  // than being snapped to A1: clamping here would move it on every redraw without being asked.
  return { row, col, dx: frame.x - left, dy: frame.y - top, w: frame.w, h: frame.h };
}

/**
 * Where a new chart lands: pinned to the cell directly under the range it reads, on its left edge.
 *
 * That is where the eye already is when the chart appears, and it puts the chart beside its own
 * numbers rather than in some corner the user then has to find. It is only a starting point — the
 * anchor is the user's from the first drag onwards.
 *
 * Two charts built from the same range would otherwise land in exactly the same place, and the
 * second would look like the first having changed type rather than a new chart; the pile is only
 * discovered by dragging the top one off. So each steps clear of what is already there.
 */
export function autoChartAnchor(sheet: SheetModel, range: SheetRange): ChartAnchor {
  let anchor: ChartAnchor = {
    row: Math.min(range.endRow + 1, Math.max(sheet.rows - 1, 0)),
    col: range.startCol,
    dx: 0,
    dy: 8,
    w: DEFAULT_CHART_W,
    h: DEFAULT_CHART_H,
  };
  const occupied = (a: ChartAnchor) =>
    (sheet.charts ?? []).some(
      (c) => c.anchor && c.anchor.row === a.row && c.anchor.col === a.col && Math.abs(c.anchor.dy - a.dy) < 2
    );
  // Bounded so a sheet whose charts happen to sit on every step can't spin here.
  for (let step = 0; step < 24 && occupied(anchor); step++) {
    anchor = { ...anchor, col: Math.min(anchor.col + 1, Math.max(sheet.cols - 1, 0)), dy: anchor.dy + CASCADE };
  }
  return anchor;
}

/**
 * An anchor for a chart however it was stored: its own, one converted from the pixel position
 * charts used to carry, or an automatic placement for one that has neither.
 */
export function chartAnchorOf(sheet: SheetModel, chart: ChartSpec, hiddenRows?: ReadonlySet<number>): ChartAnchor {
  if (chart.anchor) return chart.anchor;
  if (chart.frame) return frameToAnchor(sheet, chart.frame, hiddenRows);
  return autoChartAnchor(sheet, chart.range);
}
