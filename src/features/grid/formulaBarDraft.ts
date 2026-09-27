// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * What the formula bar is holding that the cell is not: text somebody typed into it, for one cell.
 *
 * There is no draft until a key is pressed in the bar. Before, the bar kept its own copy of the
 * cell's content from the moment it was shown, and wrote that copy back on blur whenever it
 * differed from the cell — so after a sort, a Delete or an undo changed the cell under the same
 * address, clicking into the bar and out again put the old value back (#42).
 */
export interface FormulaBarDraft {
  /** Which cell the text was typed for — sheet included, so a tab switch cannot carry it over. */
  cellKey: string;
  text: string;
}

export const formulaBarCellKey = (sheetId: string, row: number, col: number) => `${sheetId}:${row},${col}`;

/** What the bar shows: the draft while one is being typed for this cell, otherwise the cell as it is now. */
export function formulaBarShown(draft: FormulaBarDraft | null, cellKey: string, raw: string): string {
  return draft && draft.cellKey === cellKey ? draft.text : raw;
}

/**
 * What leaving the bar writes, or `null` for nothing.
 *
 * Nothing unless something was typed for this very cell, and nothing if what was typed is what the
 * cell already holds — focusing the bar and leaving it is never a write.
 */
export function formulaBarWrite(draft: FormulaBarDraft | null, cellKey: string, raw: string): string | null {
  if (!draft || draft.cellKey !== cellKey) return null;
  return draft.text === raw ? null : draft.text;
}
