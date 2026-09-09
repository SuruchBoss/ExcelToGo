import { FormulaValue } from "./formulaEngine/types";
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

/**
 * Given the cell the user had selected when they asked to sort, figures out what range to
 * sort: the selection itself if it already spans more than one row, or — for a single-cell
 * selection — the contiguous non-blank block around it (like Excel's ribbon Sort buttons),
 * auto-excluding the top row from the sort if it looks like a text header sitting over mostly
 * numeric data in the sort column.
 */
export function detectSortRange(sheet: SheetModel, computed: ComputedSheet, selection: SortRange, anchorRow: number, anchorCol: number): SortRange {
  if (selection.startRow !== selection.endRow) {
    return { startRow: selection.startRow, endRow: selection.endRow, startCol: selection.startCol, endCol: selection.endCol };
  }
  let top = anchorRow;
  while (top > 0 && !isRowBlank(sheet, top - 1)) top--;
  let bottom = anchorRow;
  while (bottom < sheet.rows - 1 && !isRowBlank(sheet, bottom + 1)) bottom++;

  let startRow = top;
  if (bottom > top) {
    const headerVal = computed.values[top][anchorCol];
    const isHeaderTextual = typeof headerVal === "string" && headerVal.trim() !== "";
    let numericCount = 0;
    for (let r = top + 1; r <= bottom; r++) {
      if (typeof computed.values[r][anchorCol] === "number") numericCount++;
    }
    if (isHeaderTextual && numericCount >= Math.ceil((bottom - top) / 2)) startRow = top + 1;
  }
  return { startRow, endRow: bottom, startCol: 0, endCol: sheet.cols - 1 };
}

/**
 * Reorders rows within `range` by the values in `sortCol` (computed values, so a formula
 * column sorts by its result). Only the cells inside the range's column span move — like
 * Excel, sorting a range that doesn't cover every column leaves the other columns' rows where
 * they were. Blank cells always sort to the end. Formula *text* isn't rewritten to follow its
 * row (Excel doesn't do this either), so a relative formula may now compute something
 * different — sorting a range with such formulas in it isn't generally safe, same as Excel.
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
      next.cells[destRow][c] = snapshotCells[i][c - startCol];
      next.formats[destRow][c] = snapshotFormats[i][c - startCol];
    }
  }
  return next;
}
