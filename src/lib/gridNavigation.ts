// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Where the keyboard moves the cursor.
 *
 * Someone who opens a spreadsheet types before they read anything, and the first thing their hands
 * try is Ctrl+Down. Arrow keys alone are what a grid demo has; the jumps are what make it feel like
 * the tool it is imitating, and getting them subtly wrong is worse than not having them — a cursor
 * that lands one row off is a cursor you stop trusting.
 *
 * Kept as pure functions over an `isEmpty` probe rather than over a sheet, so the rules can be
 * tested on a hand-drawn grid without building a workbook, and so the grid component holds no
 * copy of the arithmetic.
 */

export interface CellPosition {
  row: number;
  col: number;
}

export interface CellBlock {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/** Reads true for a cell with nothing in it. */
export type IsEmpty = (row: number, col: number) => boolean;

export interface GridBounds {
  rows: number;
  cols: number;
}

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), Math.max(max, 0));

/**
 * Ctrl+arrow: to the edge of the data, the way Excel does it.
 *
 * Two rules, and which one applies is decided by the neighbouring cell, not by the cell you are on:
 *
 * - **Neighbour has something in it** → run to the last filled cell before the next gap. This is
 *   what gets you to the bottom of a column in one keystroke, and it works from an empty cell
 *   directly above a block too, which is the case that is easy to get wrong.
 * - **Neighbour is empty** → skip the gap and land on the next filled cell. Nothing further in
 *   that direction means the edge of the sheet, which is where Ctrl+Down lands on a blank sheet.
 */
export function jumpToEdge(
  isEmpty: IsEmpty,
  { rows, cols }: GridBounds,
  from: CellPosition,
  dRow: number,
  dCol: number
): CellPosition {
  const inside = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols;

  let r = from.row + dRow;
  let c = from.col + dCol;
  if (!inside(r, c)) return { row: from.row, col: from.col };

  if (!isEmpty(r, c)) {
    while (inside(r + dRow, c + dCol) && !isEmpty(r + dRow, c + dCol)) {
      r += dRow;
      c += dCol;
    }
    return { row: r, col: c };
  }

  while (inside(r, c) && isEmpty(r, c)) {
    r += dRow;
    c += dCol;
  }
  // Walked off the end without finding anything: the sheet's own edge is the answer.
  return inside(r, c) ? { row: r, col: c } : { row: clamp(r, rows - 1), col: clamp(c, cols - 1) };
}

/**
 * The furthest cell anything has been written to — Ctrl+End.
 *
 * The last row and the last column are found independently, exactly as Excel does: the corner it
 * lands on can itself be empty, because it is the corner of the used rectangle rather than a cell
 * anyone typed in.
 */
export function usedBounds(isEmpty: IsEmpty, { rows, cols }: GridBounds): CellPosition {
  let lastRow = 0;
  let lastCol = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isEmpty(r, c)) continue;
      if (r > lastRow) lastRow = r;
      if (c > lastCol) lastCol = c;
    }
  }
  return { row: lastRow, col: lastCol };
}

/** The last filled cell in a row — the End key on its own. */
export function rowEnd(isEmpty: IsEmpty, { rows, cols }: GridBounds, row: number): number {
  if (row < 0 || row >= rows) return 0;
  for (let c = cols - 1; c > 0; c--) if (!isEmpty(row, c)) return c;
  return 0;
}

/**
 * The block of filled cells a cell belongs to — what Ctrl+A selects before it selects everything.
 *
 * Grown a whole edge at a time rather than cell by cell: a table with one blank cell in the middle
 * of a column is still one table, and a flood fill would stop at the hole.
 */
export function blockAround(
  isEmpty: IsEmpty,
  { rows, cols }: GridBounds,
  from: CellPosition
): CellBlock {
  let { row: startRow, col: startCol } = from;
  let endRow = from.row;
  let endCol = from.col;

  const rowHasContent = (r: number, c0: number, c1: number) => {
    for (let c = c0; c <= c1; c++) if (!isEmpty(r, c)) return true;
    return false;
  };
  const colHasContent = (c: number, r0: number, r1: number) => {
    for (let r = r0; r <= r1; r++) if (!isEmpty(r, c)) return true;
    return false;
  };

  for (let grew = true; grew; ) {
    grew = false;
    if (startRow > 0 && rowHasContent(startRow - 1, startCol, endCol)) {
      startRow--;
      grew = true;
    }
    if (endRow < rows - 1 && rowHasContent(endRow + 1, startCol, endCol)) {
      endRow++;
      grew = true;
    }
    if (startCol > 0 && colHasContent(startCol - 1, startRow, endRow)) {
      startCol--;
      grew = true;
    }
    if (endCol < cols - 1 && colHasContent(endCol + 1, startRow, endRow)) {
      endCol++;
      grew = true;
    }
  }
  return { startRow, startCol, endRow, endCol };
}

/**
 * The row a page up or down lands on.
 *
 * Measured in pixels off the same offsets the grid scrolls by, not in a fixed number of rows: a
 * sheet with row heights from an imported file has no single row count that fills a screen. Always
 * moves at least one row, so the key never looks broken on a viewport shorter than one row.
 */
export function pageStep(offsets: number[], row: number, viewportHeight: number, dir: 1 | -1): number {
  const rows = offsets.length - 1;
  if (rows <= 0) return 0;
  const target = offsets[clamp(row, rows - 1)] + dir * viewportHeight;

  let landed = clamp(row + dir, rows - 1);
  if (dir === 1) {
    for (let r = row + 1; r < rows; r++) {
      if (offsets[r] > target) break;
      landed = r;
    }
  } else {
    for (let r = row - 1; r >= 0; r--) {
      landed = r;
      if (offsets[r] <= target) break;
    }
  }
  return clamp(landed, rows - 1);
}
