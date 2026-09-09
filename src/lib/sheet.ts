import { parseFormula, FormulaSyntaxError } from "./formulaEngine/parser";
import { evaluate } from "./formulaEngine/evaluator";
import { FormulaError, FormulaValue } from "./formulaEngine/types";
import { toDisplayString } from "./formulaEngine/coerce";
import { cellRef, colToLetters } from "./formulaEngine/address";
import { shiftFormulaRefs } from "./formulaEngine/shift";
import { adjustFormulaForStructuralOp, Axis } from "./formulaEngine/structuralShift";
import { CellFormat, formatNumberForDisplay } from "./cellFormat";

export const DEFAULT_ROWS = 30;
export const DEFAULT_COLS = 10;

export interface SheetModel {
  rows: number;
  cols: number;
  cells: string[][];
  /** Sparse — a cell with no entry (or an empty object) uses default formatting. */
  formats: (CellFormat | undefined)[][];
}

export function createEmptySheet(rows = DEFAULT_ROWS, cols = DEFAULT_COLS): SheetModel {
  return {
    rows,
    cols,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => "")),
    formats: Array.from({ length: rows }, () => Array.from({ length: cols }, () => undefined)),
  };
}

export function cloneSheet(sheet: SheetModel): SheetModel {
  return {
    ...sheet,
    cells: sheet.cells.map((row) => [...row]),
    formats: sheet.formats.map((row) => [...row]),
  };
}

export function setCellRaw(sheet: SheetModel, row: number, col: number, raw: string): SheetModel {
  const next = cloneSheet(sheet);
  next.cells[row][col] = raw;
  return next;
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
  };
}

export function addColumn(sheet: SheetModel): SheetModel {
  return {
    ...sheet,
    cols: sheet.cols + 1,
    cells: sheet.cells.map((r) => [...r, ""]),
    formats: sheet.formats.map((r) => [...r, undefined]),
  };
}

const CIRCULAR = new FormulaError("#CIRCULAR!");

export interface ComputedSheet {
  values: FormulaValue[][];
  display: string[][];
}

export function computeSheet(sheet: SheetModel): ComputedSheet {
  const memo = new Map<string, FormulaValue>();
  const computing = new Set<string>();

  function getCell(r: number, c: number): FormulaValue {
    if (r < 0 || c < 0 || r >= sheet.rows || c >= sheet.cols) return null;
    const key = `${r},${c}`;
    if (memo.has(key)) return memo.get(key)!;
    if (computing.has(key)) return CIRCULAR;

    const raw = sheet.cells[r]?.[c] ?? "";
    let result: FormulaValue;
    if (raw.startsWith("=") && raw.length > 1) {
      computing.add(key);
      try {
        const ast = parseFormula(raw.slice(1));
        const evalRes = evaluate(ast, { getCell });
        result = evalRes.kind === "scalar" ? evalRes.value : evalRes.rows[0]?.[0] ?? null;
      } catch (e) {
        result = new FormulaError(e instanceof FormulaSyntaxError ? "#SYNTAX!" : "#ERROR!");
      }
      computing.delete(key);
    } else if (raw === "") {
      result = null;
    } else {
      const n = Number(raw);
      result = raw.trim() !== "" && !Number.isNaN(n) ? n : raw;
    }
    memo.set(key, result);
    return result;
  }

  const values: FormulaValue[][] = [];
  const display: string[][] = [];
  for (let r = 0; r < sheet.rows; r++) {
    const valueRow: FormulaValue[] = [];
    const displayRow: string[] = [];
    for (let c = 0; c < sheet.cols; c++) {
      const v = getCell(r, c);
      valueRow.push(v);
      const numberFormat = sheet.formats[r]?.[c]?.numberFormat;
      displayRow.push(
        typeof v === "number" && numberFormat && numberFormat !== "general"
          ? formatNumberForDisplay(v, numberFormat)
          : toDisplayString(v)
      );
    }
    values.push(valueRow);
    display.push(displayRow);
  }
  return { values, display };
}

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
  };
}

export function insertColumnBefore(sheet: SheetModel, col: number): SheetModel {
  const adjusted = adjustAllFormulas(sheet, "col", col, 1);
  return {
    ...adjusted,
    cols: adjusted.cols + 1,
    cells: adjusted.cells.map((r) => [...r.slice(0, col), "", ...r.slice(col)]),
    formats: adjusted.formats.map((r) => [...r.slice(0, col), undefined, ...r.slice(col)]),
  };
}

export interface ClipboardBlock {
  rows: string[][];
  formats: (CellFormat | undefined)[][];
  startRow: number;
  startCol: number;
}

export function copyRange(
  sheet: SheetModel,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): ClipboardBlock {
  const rows: string[][] = [];
  const formats: (CellFormat | undefined)[][] = [];
  for (let r = startRow; r <= endRow; r++) {
    const row: string[] = [];
    const formatRow: (CellFormat | undefined)[] = [];
    for (let c = startCol; c <= endCol; c++) {
      row.push(sheet.cells[r]?.[c] ?? "");
      formatRow.push(sheet.formats[r]?.[c]);
    }
    rows.push(row);
    formats.push(formatRow);
  }
  return { rows, formats, startRow, startCol };
}

function ensureBounds(sheet: SheetModel, minRows: number, minCols: number): SheetModel {
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
    for (let c = 0; c < width; c++) {
      const raw = clip.rows[r][c];
      next.cells[targetRow + r][targetCol + c] =
        raw.startsWith("=") && raw.length > 1 ? `=${shiftFormulaRefs(raw.slice(1), rowOffset, colOffset)}` : raw;
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

export function clearRange(sheet: SheetModel, startRow: number, startCol: number, endRow: number, endCol: number): SheetModel {
  const next = cloneSheet(sheet);
  for (let r = startRow; r <= endRow; r++) {
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

export { cellRef, colToLetters };
export type { CellFormat, CellAlign, NumberFormat } from "./cellFormat";
export { NUMBER_FORMAT_LABELS } from "./cellFormat";
