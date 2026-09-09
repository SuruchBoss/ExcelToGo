import { tokenize } from "./tokenizer";
import { colToLetters, lettersToCol } from "./address";

export type Axis = "row" | "col";

const CELL_TOKEN_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/;
const REF_ERROR = "#REF!";

/** Adjusts a single index (0-based) on the axis being inserted/deleted, or returns null if
 *  that index is exactly the row/column being deleted (i.e. the reference is now invalid). */
function adjustIndex(index: number, opIndex: number, delta: 1 | -1): number | null {
  if (delta === -1) {
    if (index === opIndex) return null;
    return index > opIndex ? index - 1 : index;
  }
  return index >= opIndex ? index + 1 : index;
}

/** Adjusts a [start, end] span (e.g. a range's row or column bounds) the way Excel grows a
 *  range when you insert a row/column inside it and shrinks it when you delete one from
 *  inside it, only collapsing to #REF! when the whole span is removed. */
function adjustSpan(start: number, end: number, opIndex: number, delta: 1 | -1): { start: number; end: number } | null {
  if (delta === -1) {
    if (start === end && start === opIndex) return null;
    const newStart = start > opIndex ? start - 1 : start;
    const newEnd = end >= opIndex ? end - 1 : end;
    if (newStart > newEnd) return null;
    return { start: newStart, end: newEnd };
  }
  if (opIndex > start && opIndex <= end) {
    return { start, end: end + 1 };
  }
  return { start: adjustIndex(start, opIndex, delta)!, end: adjustIndex(end, opIndex, delta)! };
}

function cellIndex(token: string, axis: Axis): { abs1: string; letters: string; abs2: string; digits: string; value: number } {
  const m = CELL_TOKEN_RE.exec(token)!;
  const [, abs1, letters, abs2, digits] = m;
  const value = axis === "row" ? parseInt(digits, 10) - 1 : lettersToCol(letters);
  return { abs1, letters, abs2, digits, value };
}

function rebuildCell(parts: { abs1: string; letters: string; abs2: string; digits: string }, axis: Axis, newValue: number): string {
  if (axis === "row") return `${parts.abs1}${parts.letters}${parts.abs2}${newValue + 1}`;
  return `${parts.abs1}${colToLetters(newValue)}${parts.abs2}${parts.digits}`;
}

function adjustCellToken(token: string, axis: Axis, opIndex: number, delta: 1 | -1): string {
  const parts = cellIndex(token, axis);
  const next = adjustIndex(parts.value, opIndex, delta);
  return next === null ? REF_ERROR : rebuildCell(parts, axis, next);
}

function adjustRangeToken(token: string, axis: Axis, opIndex: number, delta: 1 | -1): string {
  const [aTok, bTok] = token.split(":");
  const a = cellIndex(aTok, axis);
  const b = cellIndex(bTok, axis);
  const span = adjustSpan(Math.min(a.value, b.value), Math.max(a.value, b.value), opIndex, delta);
  if (!span) return REF_ERROR;
  // Keep each corner's original absolute-ness and other-axis component; only replace this axis's index.
  const aIsMin = a.value <= b.value;
  const newA = rebuildCell(a, axis, aIsMin ? span.start : span.end);
  const newB = rebuildCell(b, axis, aIsMin ? span.end : span.start);
  return `${newA}:${newB}`;
}

/**
 * Rewrites cell/range references in a formula body (no leading "=") to account for a row or
 * column being inserted or deleted elsewhere in the sheet. `delta` is +1 for an insert before
 * `opIndex`, -1 for deleting `opIndex` (both 0-based). A reference that lands exactly on a
 * deleted row/column, or a range that collapses entirely, becomes the literal text "#REF!" —
 * the same way Excel shows a broken reference after a structural edit.
 */
export function adjustFormulaForStructuralOp(body: string, axis: Axis, opIndex: number, delta: 1 | -1): string {
  const tokens = tokenize(body);
  let out = "";
  for (const t of tokens) {
    switch (t.type) {
      case "EOF":
        break;
      case "CELL":
        out += adjustCellToken(t.value, axis, opIndex, delta);
        break;
      case "RANGE":
        out += adjustRangeToken(t.value, axis, opIndex, delta);
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
