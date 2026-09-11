import { parseFormula, FormulaSyntaxError } from "./formulaEngine/parser";
import { evaluate } from "./formulaEngine/evaluator";
import { FormulaError, FormulaValue } from "./formulaEngine/types";
import { toDisplayString } from "./formulaEngine/coerce";
import { cellRef, colToLetters } from "./formulaEngine/address";
import { shiftFormulaRefs } from "./formulaEngine/shift";
import { adjustFormulaForStructuralOp, Axis } from "./formulaEngine/structuralShift";
import { CellFormat, formatNumberForDisplay } from "./cellFormat";
import { SheetTemplate } from "./sheetTemplate";
import { MergeRange, shiftMerges } from "./sheetMerges";

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
    colWidths: sheet.colWidths ? [...sheet.colWidths] : undefined,
    rowHeights: sheet.rowHeights ? [...sheet.rowHeights] : undefined,
    // `template` is replaced wholesale (imported, or removed when unlocked), never edited in
    // place, so sharing the reference is safe and keeps clones cheap.
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
    rowHeights: adjusted.rowHeights ? [...adjusted.rowHeights.slice(0, row), ...adjusted.rowHeights.slice(row + 1)] : undefined,
    merges: shiftMerges(adjusted.merges, "row", row, -1),
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
  };
}

export { cellRef, colToLetters };
export type { CellFormat, CellAlign, NumberFormat } from "./cellFormat";
export type { SheetTemplate } from "./sheetTemplate";
export type { MergeRange } from "./sheetMerges";

// Re-exported so `@/lib/sheet` stays the one import surface for sheet operations, even though
// clipboard and sort logic live in their own focused modules.
export type { ClipboardBlock } from "./sheetClipboard";
export { copyRange, pasteClipboardBlock, pastePlainTextBlock, clearRange, toTsv, parseTsv } from "./sheetClipboard";
export type { SortRange } from "./sheetSort";
export { detectSortRange, sortRange } from "./sheetSort";
