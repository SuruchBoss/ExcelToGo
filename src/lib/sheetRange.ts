/**
 * A rectangle of cells, and what happens to it when rows or columns move.
 *
 * Extracted because conditional formatting rules and charts both pin themselves to a range and
 * both need it to follow an insert or delete. Their semantics are identical, and differ from
 * merges — a merge collapsing to one cell is junk and gets dropped, while a one-cell rule or a
 * one-cell chart range is ordinary. Sharing the wrong one of those would silently delete a user's
 * work, so the two behaviours live in separate functions on purpose.
 */

export interface SheetRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export type RangeAxis = "row" | "col";

/**
 * Moves a range to follow an inserted or deleted row/column.
 *
 * Returns null only when the range has no lines left at all — i.e. the deletion removed every row
 * or column it covered — because that is the only case where it has stopped meaning anything.
 */
export function shiftRange(range: SheetRange, axis: RangeAxis, index: number, delta: 1 | -1): SheetRange | null {
  const start = axis === "row" ? range.startRow : range.startCol;
  const end = axis === "row" ? range.endRow : range.endCol;

  let nextStart = start;
  let nextEnd = end;
  if (delta === 1) {
    if (start >= index) nextStart = start + 1;
    if (end >= index) nextEnd = end + 1;
  } else {
    // The deleted line vanishes: anything past it slides back, and a range containing it shrinks.
    if (start > index) nextStart = start - 1;
    if (end >= index) nextEnd = end - 1;
  }
  if (nextEnd < nextStart) return null;

  return axis === "row"
    ? { ...range, startRow: nextStart, endRow: nextEnd }
    : { ...range, startCol: nextStart, endCol: nextEnd };
}

/**
 * Moves a single row or column index to follow an inserted or deleted line.
 *
 * Used by anything pinned to one cell rather than to a block — a chart's anchor, a comment. A line
 * deleted out from under the index leaves it on whatever slid into that position, which is where
 * the thing visually ends up anyway; the alternative, dropping it, would throw away a chart or a
 * note because the column beside it went away.
 */
export function shiftPoint(index: number, at: number, delta: 1 | -1): number {
  if (delta === 1) return index >= at ? index + 1 : index;
  return index > at ? index - 1 : index;
}

export function rangeRows(range: SheetRange): number {
  return range.endRow - range.startRow + 1;
}

export function rangeCols(range: SheetRange): number {
  return range.endCol - range.startCol + 1;
}
