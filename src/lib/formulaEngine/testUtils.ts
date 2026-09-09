import { parseFormula } from "./parser";
import { evaluate, EvalContext } from "./evaluator";
import { FormulaValue } from "./types";

/** Builds an EvalContext backed by a plain 2D grid (row-major), for testing formulas that
 *  reference cells/ranges without needing a full SheetModel. */
export function gridContext(grid: FormulaValue[][]): EvalContext {
  return {
    getCell(row, col) {
      return grid[row]?.[col] ?? null;
    },
  };
}

/** Parses and evaluates a formula body (no leading "="), returning the resulting scalar value —
 *  the same "first cell of a range" unwrapping computeSheet does for a top-level range result. */
export function calc(source: string, grid: FormulaValue[][] = []): FormulaValue {
  const result = evaluate(parseFormula(source), gridContext(grid));
  return result.kind === "scalar" ? result.value : result.rows[0]?.[0] ?? null;
}
