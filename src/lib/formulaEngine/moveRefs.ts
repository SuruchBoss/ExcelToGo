// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { tokenize } from "./tokenizer";
import { colToLetters, lettersToCol, sheetRefPrefix, splitSheetRef } from "./address";

/**
 * A block of cells cut from one place and pasted in another (#51).
 *
 * In Excel a cut and paste is a *move*: every reference to a moved cell follows it, wherever the
 * formula is, and the moved formulas themselves keep pointing where they did. A copy is the
 * opposite on both counts, which is what this used to be treated as.
 */
export interface CellMove {
  /** The sheet the block was cut from. */
  fromSheet: string;
  /** The sheet it was pasted into, which may be the same one. */
  toSheet: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  /** Where each cut row went, keyed by its row before the move. A row inside the block that is not
   *  a key was not cut — a filter hid it (#50) — and references to it stay where they are. */
  rowTo: ReadonlyMap<number, number>;
  colOffset: number;
}

/** The move of a contiguous block, every row going the same distance. */
export function blockMove(
  fromSheet: string,
  toSheet: string,
  start: { row: number; col: number },
  end: { row: number; col: number },
  to: { row: number; col: number }
): CellMove {
  const rowTo = new Map<number, number>();
  for (let r = start.row; r <= end.row; r++) rowTo.set(r, to.row + r - start.row);
  return { fromSheet, toSheet, startRow: start.row, startCol: start.col, endRow: end.row, endCol: end.col, rowTo, colOffset: to.col - start.col };
}

/**
 * Which sheet a formula's bare references mean, and which sheet it will be written on.
 *
 * The two are the same for every formula that stays put. They differ for a formula that is itself
 * being moved to another sheet: its `A1` meant the sheet it was cut from, and has to go on meaning
 * that once it is written somewhere else.
 */
export interface FormulaPlace {
  readSheet: string;
  writeSheet: string;
}

const sameSheet = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const CELL_TOKEN_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/;

interface CellParts {
  colAbs: string;
  rowAbs: string;
  row: number;
  col: number;
}

function parts(token: string): CellParts | null {
  const m = CELL_TOKEN_RE.exec(token);
  if (!m) return null;
  return { colAbs: m[1], rowAbs: m[3], row: parseInt(m[4], 10) - 1, col: lettersToCol(m[2]) };
}

/** Kept `$` and all: a move follows the cell, so an absolute reference moves too. */
const write = (p: CellParts, row: number, col: number) => `${p.colAbs}${colToLetters(col)}${p.rowAbs}${row + 1}`;

const insideCols = (move: CellMove, col: number) => col >= move.startCol && col <= move.endCol;

/**
 * The address a reference moves to, or null when it does not move. A range moves only when every
 * cell in it was cut, as in Excel; one that reaches outside the block keeps its address.
 */
function movedAddress(ref: string, move: CellMove): string | null {
  const [a, b] = ref.split(":");
  const pa = parts(a);
  if (!pa) return null;
  if (b === undefined) {
    const row = move.rowTo.get(pa.row);
    if (row === undefined || !insideCols(move, pa.col)) return null;
    return write(pa, row, pa.col + move.colOffset);
  }
  const pb = parts(b);
  if (!pb) return null;
  const top = Math.min(pa.row, pb.row);
  const bottom = Math.max(pa.row, pb.row);
  if (!insideCols(move, pa.col) || !insideCols(move, pb.col)) return null;
  for (let r = top; r <= bottom; r++) if (!move.rowTo.has(r)) return null;
  return `${write(pa, move.rowTo.get(pa.row)!, pa.col + move.colOffset)}:${write(pb, move.rowTo.get(pb.row)!, pb.col + move.colOffset)}`;
}

/** One reference token, rewritten for the move and for where its formula will be written. */
function moveToken(token: string, move: CellMove, place: FormulaPlace): string {
  const { sheet: prefix, ref } = splitSheetRef(token);
  const target = prefix ?? place.readSheet;
  const moved = sameSheet(target, move.fromSheet) ? movedAddress(ref, move) : null;
  const sheet = moved === null ? target : move.toSheet;
  const address = moved ?? ref;
  // Written with a sheet name when it had one, or when the sheet it means is no longer the one
  // the formula sits on; bare otherwise, as it was typed.
  if (prefix !== null) return moved === null ? token : `${sheetRefPrefix(sheet)}${address}`;
  return sameSheet(sheet, place.writeSheet) ? address : `${sheetRefPrefix(sheet)}${address}`;
}

/**
 * Rewrites a formula body (no leading "=") for a cut and paste: references into the moved block
 * follow it, and nothing else changes — no copy-style shift. Returns the body unchanged, the same
 * string, when there is nothing to move.
 */
export function moveFormulaRefs(body: string, move: CellMove, place: FormulaPlace): string {
  let out = "";
  let changed = false;
  for (const t of tokenize(body)) {
    switch (t.type) {
      case "EOF":
        break;
      case "CELL":
      case "RANGE": {
        const next = moveToken(t.value, move, place);
        if (next !== t.value) changed = true;
        out += next;
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
  // Re-emitted text drops whitespace, so an untouched formula keeps the text it was typed with.
  return changed ? out : body;
}
