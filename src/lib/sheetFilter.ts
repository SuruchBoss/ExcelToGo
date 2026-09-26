// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Which rows a set of column filters hides.
 *
 * Pulled out of the `useHiddenRows` hook because a second caller needed it: the live region has to
 * say how many rows are left after a filter, and "4 of 9 rows" counted a second way is the kind of
 * second copy that goes quietly wrong. Pure, so the count is testable without a browser.
 */

/** Column index → the displayed values kept. A column absent from the map filters nothing. */
export type ColumnFilters = Record<number, string[]>;

export function hiddenRowsFor(display: readonly (readonly string[])[], filters: ColumnFilters): Set<number> {
  const hidden = new Set<number>();
  const cols = Object.keys(filters);
  if (cols.length === 0) return hidden;
  rows: for (let r = 0; r < display.length; r++) {
    for (const colStr of cols) {
      const col = Number(colStr);
      const value = display[r]?.[col] ?? "";
      if (!filters[col].includes(value)) {
        hidden.add(r);
        continue rows;
      }
    }
  }
  return hidden;
}

/** How many rows a reader would actually see. */
export function visibleRowCount(display: readonly (readonly string[])[], filters: ColumnFilters): number {
  return display.length - hiddenRowsFor(display, filters).size;
}
