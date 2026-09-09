import { tokenize } from "./tokenizer";
import { lettersToCol, colToLetters } from "./address";

const CELL_TOKEN_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/;

function shiftCellToken(token: string, rowOffset: number, colOffset: number): string {
  const m = CELL_TOKEN_RE.exec(token);
  if (!m) return token;
  const [, colAbs, colLetters, rowAbs, rowDigits] = m;
  const col = colAbs ? lettersToCol(colLetters) : Math.max(0, lettersToCol(colLetters) + colOffset);
  const row = rowAbs ? parseInt(rowDigits, 10) - 1 : Math.max(0, parseInt(rowDigits, 10) - 1 + rowOffset);
  return `${colAbs}${colToLetters(col)}${rowAbs}${row + 1}`;
}

function shiftRangeToken(token: string, rowOffset: number, colOffset: number): string {
  const [a, b] = token.split(":");
  return `${shiftCellToken(a, rowOffset, colOffset)}:${shiftCellToken(b, rowOffset, colOffset)}`;
}

/**
 * Shifts relative (non-$) cell/range references inside a formula body by the
 * given row/column offset, the way Excel does when you fill a formula across
 * a row or down a column. Absolute references ($A$1) are left untouched.
 * `body` is the formula text without the leading "=".
 */
export function shiftFormulaRefs(body: string, rowOffset: number, colOffset: number): string {
  if (rowOffset === 0 && colOffset === 0) return body;
  const tokens = tokenize(body);
  let out = "";
  for (const t of tokens) {
    switch (t.type) {
      case "EOF":
        break;
      case "CELL":
        out += shiftCellToken(t.value, rowOffset, colOffset);
        break;
      case "RANGE":
        out += shiftRangeToken(t.value, rowOffset, colOffset);
        break;
      case "STRING":
        out += `"${t.value.replace(/"/g, '""')}"`;
        break;
      case "COMMA":
        out += ",";
        break;
      default:
        out += t.value;
    }
  }
  return out;
}
