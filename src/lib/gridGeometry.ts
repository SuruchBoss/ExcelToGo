/**
 * Where the grid's rows and columns sit, in pixels.
 *
 * The browser lays the table out, so almost nothing in the app needs these numbers. Charts do:
 * they float above the cells in the same coordinate space and have to be placed, dragged and
 * clamped without asking the DOM where anything is. The constants live here rather than inside the
 * grid component because the two have to agree exactly — a chart placed with a column width the
 * table doesn't use would drift further from its data the further right it sat.
 */
import { ChartFrame, DEFAULT_CHART_H, DEFAULT_CHART_W } from "./charts";
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

/**
 * Where a new chart lands: directly under the range it reads, aligned to its left edge.
 *
 * That is where the eye already is when the chart appears, and it puts the chart beside its own
 * numbers rather than in some corner the user then has to find. It is only a starting point — the
 * frame is the user's from the first drag onwards.
 *
 * Two charts built from the same range would otherwise land in exactly the same place, and the
 * second would look like the first having changed type rather than a new chart; the pile is only
 * discovered by dragging the top one off. So each steps clear of what is already there.
 */
export function autoChartFrame(sheet: SheetModel, range: SheetRange, hiddenRows?: ReadonlySet<number>): ChartFrame {
  let frame: ChartFrame = {
    x: columnLeft(sheet, range.startCol),
    y: rowTop(sheet, range.endRow + 1, hiddenRows) + 8,
    w: DEFAULT_CHART_W,
    h: DEFAULT_CHART_H,
  };
  const occupied = (f: ChartFrame) =>
    (sheet.charts ?? []).some((c) => c.frame && Math.abs(c.frame.x - f.x) < 2 && Math.abs(c.frame.y - f.y) < 2);
  // Bounded so a sheet whose charts happen to sit on every step can't spin here.
  for (let step = 0; step < 24 && occupied(frame); step++) {
    frame = { ...frame, x: frame.x + CASCADE, y: frame.y + CASCADE };
  }
  return frame;
}
