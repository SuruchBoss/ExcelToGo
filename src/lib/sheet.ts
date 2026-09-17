import { CellComments, shiftComments } from "./cellComments";
import { PivotSource } from "./pivot";
import { cellRef, colToLetters } from "./formulaEngine/address";
import { shiftFormulaRefs } from "./formulaEngine/shift";
import { adjustFormulaForStructuralOp, Axis } from "./formulaEngine/structuralShift";
import { CellFormat } from "./cellFormat";
import { SheetTemplate } from "./sheetTemplate";
import { MergeRange, shiftMerges } from "./sheetMerges";
import { CfRule, shiftConditionalRules } from "./conditionalFormat";
import { ChartSpec, shiftCharts } from "./charts";

export const DEFAULT_ROWS = 30;
export const DEFAULT_COLS = 10;

export interface SheetModel {
  rows: number;
  cols: number;
  cells: string[][];
  /** Sparse — a cell with no entry (or an empty object) uses default formatting. */
  formats: (CellFormat | undefined)[][];
  /** Per-column pixel widths carried over from an imported file. Sparse; a missing entry uses the
   *  grid's default width. */
  colWidths?: (number | undefined)[];
  /** Per-row pixel heights carried over from an imported file. Sparse, like `colWidths`. */
  rowHeights?: (number | undefined)[];
  /** Merged cell ranges from an imported file. See sheetMerges.ts. */
  merges?: MergeRange[];
  /** Present only while an imported template's sheet protection is in force. See sheetTemplate.ts. */
  template?: SheetTemplate;
  /** Rules that restyle cells from their current values. See conditionalFormat.ts. */
  conditionalRules?: CfRule[];
  /** Charts drawn from ranges of this sheet. See charts.ts. */
  charts?: ChartSpec[];
  /** Notes attached to individual cells, keyed by position. See cellComments.ts. */
  comments?: CellComments;
  /** Set on a sheet that *is* a pivot: where it was built from, so it can be rebuilt. See pivot.ts. */
  pivot?: PivotSource;
}

export function createEmptySheet(rows = DEFAULT_ROWS, cols = DEFAULT_COLS): SheetModel {
  return {
    rows,
    cols,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => "")),
    formats: Array.from({ length: rows }, () => Array.from({ length: cols }, () => undefined)),
  };
}

/**
 * Builds a sheet from a rectangle of raw cell text — what a CSV parses into.
 *
 * Kept at least the default size even for a three-row file, so an import lands in a spreadsheet
 * with room to work in rather than a grid that ends where the data does.
 */
export function sheetFromGrid(grid: string[][]): SheetModel {
  const rows = Math.max(DEFAULT_ROWS, grid.length);
  const cols = Math.max(DEFAULT_COLS, ...grid.map((r) => r.length), 1);
  const sheet = createEmptySheet(rows, cols);
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) sheet.cells[r][c] = grid[r][c];
  }
  return sheet;
}

export function cloneSheet(sheet: SheetModel): SheetModel {
  return {
    ...sheet,
    cells: sheet.cells.map((row) => [...row]),
    formats: sheet.formats.map((row) => [...row]),
    colWidths: sheet.colWidths ? [...sheet.colWidths] : undefined,
    rowHeights: sheet.rowHeights ? [...sheet.rowHeights] : undefined,
    // Rules are replaced as whole objects when edited, never mutated, so copying the array is
    // enough to stop one sheet's edits reaching another's history entry.
    conditionalRules: sheet.conditionalRules ? [...sheet.conditionalRules] : undefined,
    charts: sheet.charts ? [...sheet.charts] : undefined,
    // Values are plain strings replaced wholesale, so a shallow copy is enough to keep one sheet's
    // notes out of another's history entry.
    comments: sheet.comments ? { ...sheet.comments } : undefined,
    // `template` is replaced wholesale (imported, or removed when unlocked), never edited in
    // place, so sharing the reference is safe and keeps clones cheap.
  };
}

/**
 * One cell, changed.
 *
 * Copy-on-write rather than `cloneSheet`, which copies every row of both grids. Two reasons, and
 * the second is the one that matters:
 *
 * - A keystroke allocated the whole sheet. At three thousand rows that is six thousand arrays per
 *   character typed.
 * - Untouched rows come out of this with the **same array object** they went in with, which is
 *   what lets `sheetCompute.ts` find the edit by comparing rows by reference instead of comparing
 *   every cell. A deep copy hides a one-cell edit behind a grid of equal-but-not-identical rows.
 *
 * `formats` is passed through by reference, not copied. Safe because nothing writes into a sheet's
 * grids in place without calling `cloneSheet` first — the merge, paste, clear, sort and import
 * paths all do, and this comment is the reason they must keep doing it.
 */
export function setCellRaw(sheet: SheetModel, row: number, col: number, raw: string): SheetModel {
  const cells = sheet.cells.slice();
  cells[row] = cells[row].slice();
  cells[row][col] = raw;
  return { ...sheet, cells };
}

export function getCellFormat(sheet: SheetModel, row: number, col: number): CellFormat {
  return sheet.formats[row]?.[col] ?? {};
}

export function setRangeFormat(
  sheet: SheetModel,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  patch: Partial<CellFormat>
): SheetModel {
  const next = cloneSheet(sheet);
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      if (!next.formats[r]) continue;
      next.formats[r][c] = { ...next.formats[r][c], ...patch };
    }
  }
  return next;
}

export function addRow(sheet: SheetModel): SheetModel {
  return {
    ...sheet,
    rows: sheet.rows + 1,
    cells: [...sheet.cells.map((r) => [...r]), Array.from({ length: sheet.cols }, () => "")],
    formats: [...sheet.formats.map((r) => [...r]), Array.from({ length: sheet.cols }, () => undefined)],
    rowHeights: sheet.rowHeights ? [...sheet.rowHeights, undefined] : undefined,
  };
}

export function addColumn(sheet: SheetModel): SheetModel {
  return {
    ...sheet,
    cols: sheet.cols + 1,
    cells: sheet.cells.map((r) => [...r, ""]),
    formats: sheet.formats.map((r) => [...r, undefined]),
    colWidths: sheet.colWidths ? [...sheet.colWidths, undefined] : undefined,
  };
}

// Recalculation lives in sheetCompute.ts, which keeps a dependency graph so one edit does not
// redo the whole sheet. Re-exported from here because a sheet and the values it works out to are
// the same idea to every caller, and were one module until the graph arrived.
export { computeSheet, resetComputeCache } from "./sheetCompute";
export type { ComputedSheet } from "./sheetCompute";

export type ApplyScope = "cell" | "row" | "column" | "selection";

export interface ApplyFormulaOptions {
  scope: ApplyScope;
  /** Target cell the formula was authored for (params reference this cell as the anchor). */
  anchorRow: number;
  anchorCol: number;
  /** Required when scope is "selection". */
  selection?: { startRow: number; startCol: number; endRow: number; endCol: number };
}

/**
 * Writes a built formula (without leading "=") into the anchor cell, and —
 * depending on scope — fills it across the rest of the row, column, or a
 * selected rectangle, adjusting relative references the way Excel's fill
 * handle does.
 */
export function applyFormula(sheet: SheetModel, formulaBody: string, opts: ApplyFormulaOptions): SheetModel {
  const next = cloneSheet(sheet);
  const write = (r: number, c: number) => {
    const rowOffset = r - opts.anchorRow;
    const colOffset = c - opts.anchorCol;
    next.cells[r][c] = `=${shiftFormulaRefs(formulaBody, rowOffset, colOffset)}`;
  };

  if (opts.scope === "cell") {
    write(opts.anchorRow, opts.anchorCol);
  } else if (opts.scope === "row") {
    for (let c = 0; c < sheet.cols; c++) write(opts.anchorRow, c);
  } else if (opts.scope === "column") {
    for (let r = 0; r < sheet.rows; r++) write(r, opts.anchorCol);
  } else if (opts.scope === "selection" && opts.selection) {
    const { startRow, startCol, endRow, endCol } = opts.selection;
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) write(r, c);
    }
  }
  return next;
}

function adjustAllFormulas(sheet: SheetModel, axis: Axis, opIndex: number, delta: 1 | -1): SheetModel {
  const next = cloneSheet(sheet);
  for (let r = 0; r < next.rows; r++) {
    for (let c = 0; c < next.cols; c++) {
      const raw = next.cells[r][c];
      if (raw.startsWith("=") && raw.length > 1) {
        next.cells[r][c] = `=${adjustFormulaForStructuralOp(raw.slice(1), axis, opIndex, delta)}`;
      }
    }
  }
  return next;
}

/** Deletes row `row` (0-based), shifting formula references elsewhere in the sheet the way
 *  Excel does (refs to the deleted row become #REF!, refs below it shift up). Refuses to
 *  delete the sheet's only remaining row. */
export function deleteRow(sheet: SheetModel, row: number): SheetModel {
  if (sheet.rows <= 1) return sheet;
  const adjusted = adjustAllFormulas(sheet, "row", row, -1);
  return {
    ...adjusted,
    rows: adjusted.rows - 1,
    cells: [...adjusted.cells.slice(0, row), ...adjusted.cells.slice(row + 1)],
    formats: [...adjusted.formats.slice(0, row), ...adjusted.formats.slice(row + 1)],
    rowHeights: adjusted.rowHeights ? [...adjusted.rowHeights.slice(0, row), ...adjusted.rowHeights.slice(row + 1)] : undefined,
    merges: shiftMerges(adjusted.merges, "row", row, -1),
    conditionalRules: shiftConditionalRules(adjusted.conditionalRules, "row", row, -1),
    charts: shiftCharts(adjusted.charts, "row", row, -1),
    comments: shiftComments(adjusted.comments, "row", row, -1),
  };
}

export function insertRowBefore(sheet: SheetModel, row: number): SheetModel {
  const adjusted = adjustAllFormulas(sheet, "row", row, 1);
  const blankCells = Array.from({ length: adjusted.cols }, () => "");
  const blankFormats = Array.from({ length: adjusted.cols }, () => undefined);
  return {
    ...adjusted,
    rows: adjusted.rows + 1,
    cells: [...adjusted.cells.slice(0, row), blankCells, ...adjusted.cells.slice(row)],
    formats: [...adjusted.formats.slice(0, row), blankFormats, ...adjusted.formats.slice(row)],
    rowHeights: adjusted.rowHeights ? [...adjusted.rowHeights.slice(0, row), undefined, ...adjusted.rowHeights.slice(row)] : undefined,
    merges: shiftMerges(adjusted.merges, "row", row, 1),
    conditionalRules: shiftConditionalRules(adjusted.conditionalRules, "row", row, 1),
    charts: shiftCharts(adjusted.charts, "row", row, 1),
    comments: shiftComments(adjusted.comments, "row", row, 1),
  };
}

/** Deletes column `col` (0-based); see deleteRow for the reference-adjustment behavior. */
export function deleteColumn(sheet: SheetModel, col: number): SheetModel {
  if (sheet.cols <= 1) return sheet;
  const adjusted = adjustAllFormulas(sheet, "col", col, -1);
  return {
    ...adjusted,
    cols: adjusted.cols - 1,
    cells: adjusted.cells.map((r) => [...r.slice(0, col), ...r.slice(col + 1)]),
    formats: adjusted.formats.map((r) => [...r.slice(0, col), ...r.slice(col + 1)]),
    colWidths: adjusted.colWidths ? [...adjusted.colWidths.slice(0, col), ...adjusted.colWidths.slice(col + 1)] : undefined,
    merges: shiftMerges(adjusted.merges, "col", col, -1),
    conditionalRules: shiftConditionalRules(adjusted.conditionalRules, "col", col, -1),
    charts: shiftCharts(adjusted.charts, "col", col, -1),
    comments: shiftComments(adjusted.comments, "col", col, -1),
  };
}

export function insertColumnBefore(sheet: SheetModel, col: number): SheetModel {
  const adjusted = adjustAllFormulas(sheet, "col", col, 1);
  return {
    ...adjusted,
    cols: adjusted.cols + 1,
    cells: adjusted.cells.map((r) => [...r.slice(0, col), "", ...r.slice(col)]),
    formats: adjusted.formats.map((r) => [...r.slice(0, col), undefined, ...r.slice(col)]),
    colWidths: adjusted.colWidths ? [...adjusted.colWidths.slice(0, col), undefined, ...adjusted.colWidths.slice(col)] : undefined,
    merges: shiftMerges(adjusted.merges, "col", col, 1),
    conditionalRules: shiftConditionalRules(adjusted.conditionalRules, "col", col, 1),
    charts: shiftCharts(adjusted.charts, "col", col, 1),
    comments: shiftComments(adjusted.comments, "col", col, 1),
  };
}

export { cellRef, colToLetters };
export type { CellFormat, CellAlign, NumberFormat } from "./cellFormat";
export type { SheetTemplate } from "./sheetTemplate";
export type { MergeRange } from "./sheetMerges";
export type { CfRule, CfRange, CfTest, CfStyle, CfVisual } from "./conditionalFormat";
export type { ChartSpec, ChartKind, ChartFrame, ChartAnchor } from "./charts";
export type { CellComments } from "./cellComments";
export { commentKey, getComment, setComment } from "./cellComments";
export type { SheetRange } from "./sheetRange";

// Re-exported so `@/lib/sheet` stays the one import surface for sheet operations, even though
// clipboard and sort logic live in their own focused modules.
export type { ClipboardBlock } from "./sheetClipboard";
export { copyRange, pasteClipboardBlock, pastePlainTextBlock, clearRange, toTsv, parseTsv } from "./sheetClipboard";
export type { SortRange } from "./sheetSort";
export { detectSortRange, sortRange } from "./sheetSort";
