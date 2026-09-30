// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { FormulaValue } from "./formulaEngine/types";
import { moveOwnRowRefs, rowReferences } from "./formulaEngine/shift";
import { cloneSheet, ComputedSheet, SheetModel } from "./sheet";

function compareCellValues(a: FormulaValue, b: FormulaValue): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "number") return -1;
  if (typeof b === "number") return 1;
  const as = a === null || a === undefined ? "" : String(a);
  const bs = b === null || b === undefined ? "" : String(b);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

function isBlankValue(v: FormulaValue): boolean {
  return v === null || v === undefined || v === "";
}

function isRowBlank(sheet: SheetModel, row: number): boolean {
  return sheet.cells[row].every((v) => v.trim() === "");
}

export interface SortRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

/** How a header row tends to be drawn: bold, or a band of colour. */
function looksStyled(format: { bold?: boolean; fill?: string } | undefined): boolean {
  return Boolean(format?.bold || format?.fill);
}

/**
 * Whether the top row of a block is a header rather than the first row of data (#49).
 *
 * One rule, whichever way the sort runs. It used to look only at the column being sorted, and only
 * for a text header over numbers, so a text column never had a header: sorting names Z→A put
 * "Name" at the bottom. Ascending only looked right because "N" sorts before lowercase letters.
 *
 * The top row is a header when it holds no numbers, and anything in the block says it is a
 * different kind of row from the ones under it:
 * - **a column of numbers under a word** — in any column, not just the one being sorted;
 * - **a label over an empty column** — "City" with nothing entered under it yet;
 * - **drawn differently** — bold or filled, where the row under it is not.
 *
 * A single column of plain, unformatted words has none of these, so its first row is sorted like
 * the rest. Excel guesses the same way; selecting the rows to sort is the way to be exact.
 */
export function topRowIsHeader(sheet: SheetModel, computed: ComputedSheet, top: number, bottom: number): boolean {
  if (bottom <= top) return false;
  const header = computed.values[top];
  let words = 0;
  for (let c = 0; c < sheet.cols; c++) {
    const v = header[c];
    if (typeof v === "number") return false;
    if (typeof v === "string" && v.trim() !== "") words++;
  }
  if (words === 0) return false;

  for (let c = 0; c < sheet.cols; c++) {
    const v = header[c];
    if (typeof v !== "string" || v.trim() === "") continue;
    let filled = 0;
    let numbers = 0;
    for (let r = top + 1; r <= bottom; r++) {
      const below = computed.values[r][c];
      if (isBlankValue(below)) continue;
      filled++;
      if (typeof below === "number") numbers++;
    }
    if (filled === 0) return true;
    if (numbers * 2 >= filled) return true;
  }

  const styledTop = sheet.formats[top]?.some((f, c) => looksStyled(f) && !isBlankValue(header[c]));
  const styledNext = sheet.formats[top + 1]?.some(looksStyled);
  return Boolean(styledTop && !styledNext);
}

/**
 * Given the cell the user had selected when they asked to sort, figures out what range to
 * sort: the selection itself if it already spans more than one row, or — for a single-cell
 * selection — the contiguous non-blank block around it (like Excel's ribbon Sort buttons),
 * leaving its top row where it is when that row is a header (`topRowIsHeader`).
 */
export function detectSortRange(sheet: SheetModel, computed: ComputedSheet, selection: SortRange, anchorRow: number): SortRange {
  if (selection.startRow !== selection.endRow) {
    return { startRow: selection.startRow, endRow: selection.endRow, startCol: selection.startCol, endCol: selection.endCol };
  }
  let top = anchorRow;
  while (top > 0 && !isRowBlank(sheet, top - 1)) top--;
  let bottom = anchorRow;
  while (bottom < sheet.rows - 1 && !isRowBlank(sheet, bottom + 1)) bottom++;

  const startRow = topRowIsHeader(sheet, computed, top, bottom) ? top + 1 : top;
  return { startRow, endRow: bottom, startCol: 0, endCol: sheet.cols - 1 };
}

/**
 * Reorders rows within `range` by the values in `sortCol` (computed values, so a formula column
 * sorts by its result). Only the cells inside the range's column span move — like Excel, sorting a
 * range that doesn't cover every column leaves the other columns' rows where they were. Blank cells
 * always sort to the end.
 *
 * A formula moves with its row and its relative references move with it (#48): `=C2*D2` sorted to
 * row 5 is `=C5*D5`, so every row still multiplies its own price by its own quantity. References to
 * rows outside the range and to other sheets stay put — they did not move (see `moveOwnRowRefs`).
 * This used to move the text unchanged, and each row's total quietly read another row's numbers
 * while the grand total still added up. Formulas that point at *other* rows cannot come through a
 * sort right in any spreadsheet; `sortRisks` finds them so the app can say so first.
 */
export function sortRange(sheet: SheetModel, computed: ComputedSheet, range: SortRange, sortCol: number, ascending: boolean): SheetModel {
  const { startRow, endRow, startCol, endCol } = range;
  const rowOrder = [];
  for (let r = startRow; r <= endRow; r++) rowOrder.push(r);

  rowOrder.sort((ra, rb) => {
    const va = computed.values[ra][sortCol];
    const vb = computed.values[rb][sortCol];
    const blankA = isBlankValue(va);
    const blankB = isBlankValue(vb);
    if (blankA && blankB) return 0;
    if (blankA) return 1;
    if (blankB) return -1;
    const cmp = compareCellValues(va, vb);
    return ascending ? cmp : -cmp;
  });

  const snapshotCells = rowOrder.map((r) => sheet.cells[r].slice(startCol, endCol + 1));
  const snapshotFormats = rowOrder.map((r) => sheet.formats[r].slice(startCol, endCol + 1));

  const next = cloneSheet(sheet);
  for (let i = 0; i < rowOrder.length; i++) {
    const destRow = startRow + i;
    for (let c = startCol; c <= endCol; c++) {
      const raw = snapshotCells[i][c - startCol];
      const moved = destRow - rowOrder[i];
      next.cells[destRow][c] = moved !== 0 && raw.startsWith("=") && raw.length > 1 ? `=${moveOwnRowRefs(raw.slice(1), rowOrder[i], moved)}` : raw;
      next.formats[destRow][c] = snapshotFormats[i][c - startCol];
    }
  }
  return next;
}

/**
 * The formulas in `range` that a sort would break, as `[row, col]` (#48): any that point at another
 * row inside the range (a running total, a grand total caught in the range), or fix a row inside it
 * with `$`, which stays behind while the row moves. Rows outside the range and other sheets do not
 * move, so a formula pointing there is safe. Excel sorts these without
 * a word; the app asks first, because a wrong number with no error is the worst thing it can show.
 */
export function sortRisks(sheet: SheetModel, range: SortRange): [number, number][] {
  const out: [number, number][] = [];
  for (let r = range.startRow; r <= range.endRow; r++) {
    for (let c = range.startCol; c <= range.endCol; c++) {
      const raw = sheet.cells[r]?.[c] ?? "";
      if (!raw.startsWith("=") || raw.length < 2) continue;
      // Only rows inside the range move. A reference to one of them that is not this formula's own
      // row (or is its own row fixed with $, which stays behind) ends up reading a different row.
      const risky = rowReferences(raw.slice(1)).some(
        (ref) => ref.row >= range.startRow && ref.row <= range.endRow && (ref.absolute || ref.row !== r)
      );
      if (risky) out.push([r, c]);
    }
  }
  return out;
}
