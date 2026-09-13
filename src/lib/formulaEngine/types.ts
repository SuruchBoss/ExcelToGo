export class FormulaError {
  constructor(public code: string) {}
  toString() {
    return this.code;
  }
}

export const ERR_DIV0 = new FormulaError("#DIV/0!");
export const ERR_VALUE = new FormulaError("#VALUE!");
export const ERR_NAME = new FormulaError("#NAME?");
export const ERR_REF = new FormulaError("#REF!");
export const ERR_NA = new FormulaError("#N/A");
export const ERR_NUM = new FormulaError("#NUM!");

export type FormulaValue = number | string | boolean | null | FormulaError;

export function isError<T>(v: T): v is Extract<T, FormulaError> {
  return v instanceof FormulaError;
}

// Result of evaluating one AST node: either a single scalar value, or a
// rectangular range of values (rows of cells), used by functions that need
// to distinguish "a range was passed" (VLOOKUP, SUMIF) from a scalar.
export type EvalResult =
  | { kind: "scalar"; value: FormulaValue }
  | { kind: "range"; rows: FormulaValue[][]; startRow: number; startCol: number };

export function scalar(value: FormulaValue): EvalResult {
  return { kind: "scalar", value };
}

export function flattenResult(r: EvalResult): FormulaValue[] {
  if (r.kind === "scalar") return [r.value];
  return r.rows.flat();
}
