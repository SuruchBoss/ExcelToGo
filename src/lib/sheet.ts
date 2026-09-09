import { parseFormula, FormulaSyntaxError } from "./formulaEngine/parser";
import { evaluate } from "./formulaEngine/evaluator";
import { FormulaError, FormulaValue } from "./formulaEngine/types";
import { toDisplayString } from "./formulaEngine/coerce";
import { cellRef, colToLetters } from "./formulaEngine/address";

export const DEFAULT_ROWS = 30;
export const DEFAULT_COLS = 10;

export interface SheetModel {
  rows: number;
  cols: number;
  cells: string[][];
}

export function createEmptySheet(rows = DEFAULT_ROWS, cols = DEFAULT_COLS): SheetModel {
  return {
    rows,
    cols,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => "")),
  };
}

export function cloneSheet(sheet: SheetModel): SheetModel {
  return { ...sheet, cells: sheet.cells.map((row) => [...row]) };
}

export function setCellRaw(sheet: SheetModel, row: number, col: number, raw: string): SheetModel {
  const next = cloneSheet(sheet);
  next.cells[row][col] = raw;
  return next;
}

export function addRow(sheet: SheetModel): SheetModel {
  return {
    ...sheet,
    rows: sheet.rows + 1,
    cells: [...sheet.cells.map((r) => [...r]), Array.from({ length: sheet.cols }, () => "")],
  };
}

export function addColumn(sheet: SheetModel): SheetModel {
  return {
    ...sheet,
    cols: sheet.cols + 1,
    cells: sheet.cells.map((r) => [...r, ""]),
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
      displayRow.push(toDisplayString(v));
    }
    values.push(valueRow);
    display.push(displayRow);
  }
  return { values, display };
}

import { shiftFormulaRefs } from "./formulaEngine/shift";

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

export { cellRef, colToLetters };
