// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Where Enter goes after a run of Tabs: back to the column the run started in, one row down.
 *
 * It is how a row of a table gets typed in Excel — name, Tab, price, Tab, quantity, Enter — and the
 * cursor lands under the name, ready for the next row. Here Enter used to go straight down from the
 * last cell Tab reached, so every row after the first began with a walk back to the left edge.
 *
 * The run is remembered as the row it is on and the cell it last reached. Anything that moves the
 * cursor another way (a click, an arrow, a search) leaves it somewhere that is not that cell, and the
 * run no longer applies — no listener has to notice the move and clear it.
 */
export interface TabRun {
  row: number;
  startCol: number;
  lastCol: number;
}

/** The run after a Tab from (row, col) to `toCol`; a Tab from anywhere else starts a new one. */
export function afterTab(run: TabRun | null, row: number, col: number, toCol: number): TabRun {
  const continuing = run !== null && run.row === row && run.lastCol === col;
  return { row, startCol: continuing ? run.startCol : col, lastCol: toCol };
}

/** The cell Enter (or Shift+Enter) moves to from (row, col), given the run in progress, if any. */
export function afterEnter(
  run: TabRun | null,
  row: number,
  col: number,
  up: boolean,
  rows: number
): { row: number; col: number } {
  const inRun = run !== null && run.row === row && run.lastCol === col;
  return {
    row: Math.min(Math.max(row + (up ? -1 : 1), 0), rows - 1),
    col: inRun ? run.startCol : col,
  };
}
