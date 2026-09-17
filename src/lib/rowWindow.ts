import { MergeRange } from "./sheetMerges";

/**
 * Which rows a scrolled grid actually has to put in the DOM.
 *
 * The grid rendered every row of every sheet. At the thirty rows a new sheet starts with that is
 * the right thing to do; at the several thousand a real file arrives with it is thousands of
 * `<tr>` elements the browser lays out, styles and hit-tests on every render, none of which is on
 * screen. Rendering a window and standing two spacer rows in for the rest keeps the scrollbar
 * honest — the content is exactly as tall as it was — while the row count the browser deals with
 * stops growing with the file.
 *
 * Kept as plain functions away from the component because the arithmetic is where the bugs are:
 * off by one at the bottom edge, or forgetting that a filtered row takes no height. Those are
 * worth testing without a browser.
 */

/**
 * The y of each row's top edge, plus a final entry for the bottom of the last row.
 *
 * Hidden rows take no height at all, which is what keeps this in step with the table — a filtered
 * row is not rendered short, it is not rendered.
 */
export function rowOffsets(
  rows: number,
  heightOf: (row: number) => number,
  hidden?: ReadonlySet<number>
): number[] {
  const offsets = new Array<number>(rows + 1);
  let y = 0;
  for (let r = 0; r < rows; r++) {
    offsets[r] = y;
    if (!hidden?.has(r)) y += heightOf(r);
  }
  offsets[rows] = y;
  return offsets;
}

/** Index of the last row whose top edge is at or above `y`. */
function rowAt(offsets: number[], y: number): number {
  let lo = 0;
  let hi = offsets.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface RowWindow {
  /** First row to render, inclusive. */
  start: number;
  /** Last row to render, inclusive; -1 for an empty sheet. */
  end: number;
  /** Height of the spacer standing in for everything above `start`. */
  topPad: number;
  bottomPad: number;
}

export interface RowWindowInput {
  rows: number;
  offsets: number[];
  scrollTop: number;
  viewportHeight: number;
  /** Extra pixels rendered beyond each edge, so a flick does not show a blank band. */
  overscan: number;
  merges?: MergeRange[];
}

export function rowWindow({ rows, offsets, scrollTop, viewportHeight, overscan, merges }: RowWindowInput): RowWindow {
  if (rows <= 0) return { start: 0, end: -1, topPad: 0, bottomPad: 0 };

  // Before the first measurement the viewport is zero tall, which would render a single row and
  // leave the grid looking empty until a scroll event arrived. Render from the top instead.
  const height = viewportHeight > 0 ? viewportHeight : offsets[rows];

  const top = Math.max(0, scrollTop - overscan);
  const bottom = scrollTop + height + overscan;

  let start = rowAt(offsets, top);
  let end = rowAt(offsets, bottom);
  while (end < rows - 1 && offsets[end + 1] < bottom) end++;

  // A merge is one `<td>` with a rowSpan carried by its top-left cell. If that cell is above the
  // window, the cells it covers are not rendered either — they belong to it — and the merge leaves
  // a hole. Reaching back to the anchor costs a few rows and is the whole fix.
  if (merges) {
    for (const m of merges) {
      if (m.startRow < start && m.endRow >= start) start = m.startRow;
    }
  }

  return {
    start,
    end,
    topPad: offsets[start],
    bottomPad: Math.max(0, offsets[rows] - offsets[end + 1]),
  };
}

/**
 * Where to scroll so a row is fully on screen, or null when it already is.
 *
 * Needed once the grid is windowed: a selected row outside the window is not in the DOM, so
 * nothing can be asked to scroll itself into view — the position has to be worked out instead.
 */
export function scrollToShowRow(
  offsets: number[],
  row: number,
  scrollTop: number,
  viewportHeight: number,
  headerHeight: number
): number | null {
  if (row < 0 || row >= offsets.length - 1) return null;
  const top = offsets[row];
  const bottom = offsets[row + 1];
  // The sticky column header floats over the first rows of the scroll area, so a row is only
  // really visible once it is clear of it.
  if (top < scrollTop + headerHeight) return Math.max(0, top - headerHeight);
  if (bottom > scrollTop + viewportHeight) return bottom - viewportHeight;
  return null;
}
