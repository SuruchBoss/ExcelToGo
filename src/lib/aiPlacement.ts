// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { referencedRects } from "./precedents";
import type { NameTable } from "./namedRanges";

/**
 * Where an answer from the assistant goes (#64) — decided from the formula, not only the cursor,
 * so the rule holds for the model's answers as well as the keyword matcher's.
 *
 * Insert used to write into the cell under the cursor, whatever the formula said. With the cursor
 * in E5 of the sample, "total this column" came back as `=SUM(E2:E10)` and went into E5: its own
 * `=C5*D5` gone, `#CIRCULAR!` in its place. The order here is the order a person would pick:
 *
 * 1. The cell under the cursor, when it is empty and the formula does not read it.
 * 2. A total of a column goes under the column — the first cell below the range, when that cell is
 *    empty and not read — which is where AutoSum puts it and where "total this column" means.
 * 3. The cell under the cursor when it holds something the formula does not read. The panel says it
 *    will be overwritten before anyone presses the button.
 * 4. Nowhere: a formula that reads the only cell it could go into is not offered.
 */
export interface Cell {
  row: number;
  col: number;
}

function reads(rects: ReturnType<typeof referencedRects>, { row, col }: Cell): boolean {
  return rects.some((r) => row >= r.startRow && row <= r.endRow && col >= r.startCol && col <= r.endCol);
}

export function placeFormula(
  formula: string,
  anchor: Cell,
  rawAt: (row: number, col: number) => string,
  rows: number,
  names?: NameTable
): Cell | null {
  const raw = formula.startsWith("=") ? formula : `=${formula}`;
  const rects = referencedRects(raw, names);
  const empty = ({ row, col }: Cell) => row < rows && rawAt(row, col).trim() === "";

  if (empty(anchor) && !reads(rects, anchor)) return anchor;

  // One column of at least two cells: an aggregate over a column. Its answer belongs underneath.
  const columns = rects.filter((r) => r.startCol === r.endCol && r.endRow > r.startRow);
  if (rects.length === 1 && columns.length === 1) {
    const below = { row: columns[0].endRow + 1, col: columns[0].startCol };
    if (empty(below) && !reads(rects, below)) return below;
  }

  if (!empty(anchor) && !reads(rects, anchor)) return anchor;
  return null;
}

/** True when a formula written into `at` would read `at` itself. */
export function readsItself(formula: string, at: Cell, names?: NameTable): boolean {
  const raw = formula.startsWith("=") ? formula : `=${formula}`;
  return reads(referencedRects(raw, names), at);
}
