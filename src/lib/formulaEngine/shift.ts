// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

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

/**
 * The rows a formula body points at on its own sheet (0-based), each with whether its row is
 * `$`-fixed — what sort needs to know before it moves the formula (#48). A range contributes both
 * ends. References to other sheets are left out: a sort does not move them.
 */
export function rowReferences(body: string): { row: number; absolute: boolean }[] {
  const out: { row: number; absolute: boolean }[] = [];
  const add = (ref: string) => {
    const m = CELL_TOKEN_RE.exec(ref);
    if (m) out.push({ row: parseInt(m[4], 10) - 1, absolute: m[3] === "$" });
  };
  for (const t of tokenize(body)) {
    if (t.type !== "CELL" && t.type !== "RANGE") continue;
    const { sheet, ref } = splitSheetRef(t.value);
    if (sheet !== null) continue;
    for (const end of ref.split(":")) add(end);
  }
  return out;
}

/**
 * A formula moved `delta` rows by a sort, with only the references to its own row moved along
 * (#48): `=C2*D2` sorted from row 2 to row 5 is `=C5*D5`. Everything else keeps pointing where it
 * did — a rate in `E12` below the table, a cell on another sheet — because those did not move.
 * (Excel shifts every relative reference, as a copy would, which is why a rate cell there has to
 * be written `$E$12` to survive a sort.)
 */
export function moveOwnRowRefs(body: string, ownRow: number, delta: number): string {
  if (delta === 0) return body;
  const own = (ref: string) => {
    const m = CELL_TOKEN_RE.exec(ref);
    return m !== null && m[3] === "" && parseInt(m[4], 10) - 1 === ownRow;
  };
  let out = "";
  for (const t of tokenize(body)) {
    switch (t.type) {
      case "EOF":
        break;
      case "CELL":
        out += splitSheetRef(t.value).sheet === null && own(t.value) ? shiftCellToken(t.value, delta, 0) : t.value;
        break;
      case "RANGE": {
        const unqualified = splitSheetRef(t.value).sheet === null;
        const [a, b] = t.value.split(":");
        out += unqualified && own(a) && own(b) ? shiftRangeToken(t.value, delta, 0) : t.value;
        break;
      }
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
