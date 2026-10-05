// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { shiftFormulaRefs } from "./formulaEngine/shift";
import { CellFormat } from "./cellFormat";
import { addColumn, addRow, cloneSheet, SheetModel } from "./sheet";

export interface ClipboardBlock {
  rows: string[][];
  formats: (CellFormat | undefined)[][];
  startRow: number;
  startCol: number;
  /** The sheet row each of `rows` came from, when rows hidden by a filter were left out (#50).
   *  Absent means the rows are contiguous from `startRow`. A cut clears these rows and no others,
   *  and a formula shifts by how far its own row moved. */
  sourceRows?: number[];
}

/** No rows skipped: the shared empty set, so callers without a filter pass nothing. */
const NONE: ReadonlySet<number> = new Set();

/**
 * The block between two corners, leaving out `skipRows` — the rows a filter hides (#50). Excel
 * copies what is on screen; copying the hidden rows too pasted numbers nobody had seen.
 */
export function copyRange(
  sheet: SheetModel,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  skipRows: ReadonlySet<number> = NONE
): ClipboardBlock {
  const rows: string[][] = [];
  const formats: (CellFormat | undefined)[][] = [];
  const sourceRows: number[] = [];
  for (let r = startRow; r <= endRow; r++) {
    if (skipRows.has(r)) continue;
    sourceRows.push(r);
    const row: string[] = [];
    const formatRow: (CellFormat | undefined)[] = [];
    for (let c = startCol; c <= endCol; c++) {
      row.push(sheet.cells[r]?.[c] ?? "");
      formatRow.push(sheet.formats[r]?.[c]);
    }
    rows.push(row);
    formats.push(formatRow);
  }
  const skipped = sourceRows.length !== endRow - startRow + 1;
  return { rows, formats, startRow: sourceRows[0] ?? startRow, startCol, ...(skipped && { sourceRows }) };
}

export function ensureBounds(sheet: SheetModel, minRows: number, minCols: number): SheetModel {
  let next = sheet;
  while (next.rows < minRows) next = addRow(next);
  while (next.cols < minCols) next = addColumn(next);
  return next;
}

/**
 * Pastes a previously copied/cut block so its top-left lands at (targetRow, targetCol),
 * shifting relative references in any formula cell by the same offset the whole block
 * moved — the way pasting a formula in Excel adjusts A1 to A2, etc. Grows the sheet with
 * extra rows/columns rather than silently truncating if the block doesn't fit.
 */
export function pasteClipboardBlock(sheet: SheetModel, clip: ClipboardBlock, targetRow: number, targetCol: number): SheetModel {
  const rowOffset = targetRow - clip.startRow;
  const colOffset = targetCol - clip.startCol;
  const height = clip.rows.length;
  const width = clip.rows[0]?.length ?? 0;
  const next = cloneSheet(ensureBounds(sheet, targetRow + height, targetCol + width));
  for (let r = 0; r < height; r++) {
    // A block with rows left out moved each row by its own distance, and its formulas follow that.
    const moved = clip.sourceRows ? targetRow + r - clip.sourceRows[r] : rowOffset;
    for (let c = 0; c < width; c++) {
      const raw = clip.rows[r][c];
      next.cells[targetRow + r][targetCol + c] =
        raw.startsWith("=") && raw.length > 1 ? `=${shiftFormulaRefs(raw.slice(1), moved, colOffset)}` : raw;
      next.formats[targetRow + r][targetCol + c] = clip.formats[r]?.[c];
    }
  }
  return next;
}

/**
 * Writes a cut block at (targetRow, targetCol) for a move (#51). Its formulas are not shifted the
 * way a copy's are: each goes through `rewrite`, which moves only the references that point into
 * the block itself, so `=A1*2` cut from B1 to C5 still reads A1.
 */
export function placeMovedBlock(
  sheet: SheetModel,
  clip: ClipboardBlock,
  targetRow: number,
  targetCol: number,
  rewrite: (body: string) => string
): SheetModel {
  const height = clip.rows.length;
  const width = clip.rows[0]?.length ?? 0;
  const next = cloneSheet(ensureBounds(sheet, targetRow + height, targetCol + width));
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const raw = clip.rows[r][c];
      next.cells[targetRow + r][targetCol + c] = raw.startsWith("=") && raw.length > 1 ? `=${rewrite(raw.slice(1))}` : raw;
      next.formats[targetRow + r][targetCol + c] = clip.formats[r]?.[c];
    }
  }
  return next;
}

/** Pastes plain text (e.g. from the OS clipboard / another spreadsheet) as literal values —
 *  no formula reinterpretation, since we can't tell if "=SUM(...)" from another app is meant
 *  literally or as a formula in ours. */
export function pastePlainTextBlock(sheet: SheetModel, rows: string[][], targetRow: number, targetCol: number): SheetModel {
  const height = rows.length;
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const next = cloneSheet(ensureBounds(sheet, targetRow + height, targetCol + width));
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      next.cells[targetRow + r][targetCol + c] = rows[r][c];
    }
  }
  return next;
}

/** Empties the block's values, leaving `skipRows` alone — the rows a filter hides (#50). */
export function clearRange(
  sheet: SheetModel,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  skipRows: ReadonlySet<number> = NONE
): SheetModel {
  const next = cloneSheet(sheet);
  for (let r = startRow; r <= endRow; r++) {
    if (skipRows.has(r)) continue;
    for (let c = startCol; c <= endCol; c++) {
      if (next.cells[r]) next.cells[r][c] = "";
    }
  }
  return next;
}

export function toTsv(clip: ClipboardBlock): string {
  return clip.rows.map((row) => row.join("\t")).join("\n");
}

export function parseTsv(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line, i, arr) => !(i === arr.length - 1 && line === ""))
    .map((line) => line.split("\t"));
}
