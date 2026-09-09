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
