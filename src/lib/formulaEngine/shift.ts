import { tokenize } from "./tokenizer";
import { lettersToCol, colToLetters, sheetRefPrefix, splitSheetRef } from "./address";

const CELL_TOKEN_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/;

/**
 * Runs an address shift on a reference that may name another sheet, putting the name back after.
 *
 * `Sheet2!A1` filled down becomes `Sheet2!A2` in Excel — the sheet is fixed, the address is as
 * relative as it ever was. Without this the token failed `CELL_TOKEN_RE`, was handed back
 * untouched, and a column of cross-sheet formulas all read the same row. Nothing would have
 * errored; the numbers would just have been wrong.
 */
function keepingSheet(token: string, shift: (ref: string) => string): string {
  const { sheet, ref } = splitSheetRef(token);
  const next = shift(ref);
  return sheet === null ? next : `${sheetRefPrefix(sheet)}${next}`;
}

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
        out += keepingSheet(t.value, (ref) => shiftCellToken(ref, rowOffset, colOffset));
        break;
      case "RANGE":
        out += keepingSheet(t.value, (ref) => shiftRangeToken(ref, rowOffset, colOffset));
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
