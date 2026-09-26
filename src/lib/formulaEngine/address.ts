// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

// Spreadsheet A1-style address helpers. Rows/columns are 0-indexed internally;
// "A1" refers to row 0, col 0.

export function colToLetters(col: number): string {
  let n = col + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export function lettersToCol(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

export function cellRef(row: number, col: number): string {
  return `${colToLetters(col)}${row + 1}`;
}

/**
 * The sheet half of `Sheet2!A1`, quoted or not.
 *
 * Unquoted names allow Thai, because this app's own sheets are called สรุป and ยอดขาย long before
 * anyone types `Sheet2`. Quoted names allow anything but a quote, which is how Excel writes a name
 * with a space in it: `'ยอดขาย Q1'!A1`. A doubled `''` inside quotes is one literal quote, again
 * following Excel.
 */
const SHEET_PREFIX_RE = /^(?:'((?:[^']|'')+)'|([^\s'!,()+\-*/^&=<>%:]+))!/;

/** Splits `Sheet2!A1` into its two halves. `sheet` is null for a plain, same-sheet reference. */
export function splitSheetRef(ref: string): { sheet: string | null; ref: string } {
  const m = SHEET_PREFIX_RE.exec(ref);
  if (!m) return { sheet: null, ref };
  const name = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2];
  return { sheet: name, ref: ref.slice(m[0].length) };
}

/** The inverse: writes a name back, quoting it only when it needs quoting. */
export function sheetRefPrefix(sheet: string): string {
  return /^[^\s'!,()+\-*/^&=<>%:]+$/.test(sheet) ? `${sheet}!` : `'${sheet.replace(/'/g, "''")}'!`;
}

const CELL_RE = /^\$?([A-Za-z]{1,3})\$?(\d+)$/;
const RANGE_RE = /^\$?([A-Za-z]{1,3})\$?(\d+):\$?([A-Za-z]{1,3})\$?(\d+)$/;

export function parseCellRef(ref: string): { row: number; col: number } | null {
  const m = CELL_RE.exec(ref.trim());
  if (!m) return null;
  return { row: parseInt(m[2], 10) - 1, col: lettersToCol(m[1]) };
}

export interface RangeRef {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export function parseRangeRef(ref: string): RangeRef | null {
  const m = RANGE_RE.exec(ref.trim());
  if (!m) return null;
  const r1 = parseInt(m[2], 10) - 1;
  const c1 = lettersToCol(m[1]);
  const r2 = parseInt(m[4], 10) - 1;
  const c2 = lettersToCol(m[3]);
  return {
    startRow: Math.min(r1, r2),
    startCol: Math.min(c1, c2),
    endRow: Math.max(r1, r2),
    endCol: Math.max(c1, c2),
  };
}

export function rangeRefString(startRow: number, startCol: number, endRow: number, endCol: number): string {
  if (startRow === endRow && startCol === endCol) return cellRef(startRow, startCol);
  return `${cellRef(startRow, startCol)}:${cellRef(endRow, endCol)}`;
}
