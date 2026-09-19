import { AstNode } from "./ast";
import { EvalResult, FormulaValue, isError, scalar, ERR_DIV0, ERR_NAME, ERR_REF, ERR_VALUE } from "./types";
import { toNumber, toDisplayString } from "./coerce";
import { FUNCTIONS } from "./functions";

export interface EvalContext {
  /** `sheet` is the name written before a `!`, absent for a reference to the sheet being computed. */
  getCell(row: number, col: number, sheet?: string): FormulaValue;
}

export function evaluate(node: AstNode, ctx: EvalContext): EvalResult {
  switch (node.type) {
    case "number":
      return scalar(node.value);
    case "string":
      return scalar(node.value);
    case "bool":
      return scalar(node.value);
    case "cell":
      return scalar(ctx.getCell(node.row, node.col, node.sheet));
    case "referror":
      return scalar(ERR_REF);
    case "missing":
      return scalar(null);
    case "name":
      // Compilation substitutes every name the sheet defines. One still standing here is one
      // nothing defines — the same answer Excel gives, and the same one a misspelt function gets.
      return scalar(ERR_NAME);
    case "range": {
      const rows: FormulaValue[][] = [];
      for (let r = node.startRow; r <= node.endRow; r++) {
        const row: FormulaValue[] = [];
        for (let c = node.startCol; c <= node.endCol; c++) {
          row.push(ctx.getCell(r, c, node.sheet));
        }
        rows.push(row);
      }
      return { kind: "range", rows, startRow: node.startRow, startCol: node.startCol };
    }
    case "unary": {
      const v = evaluate(node.expr, ctx);
      const val = v.kind === "scalar" ? v.value : v.rows[0]?.[0] ?? null;
      const n = toNumber(val);
      if (isError(n)) return scalar(n);
      return scalar(node.op === "-" ? -n : n);
    }
    case "binop":
      return broadcast(node.op, evaluate(node.left, ctx), evaluate(node.right, ctx));
    case "call": {
      const fn = FUNCTIONS[node.name];
      if (!fn) return scalar(ERR_NAME);
      const args = node.args.map((a) => evaluate(a, ctx));
      try {
        const out = fn(args);
        // INDEX can answer with a whole row or column; everything else answers with one value.
        return typeof out === "object" && out !== null && "kind" in out ? out : scalar(out);
      } catch {
        return scalar(ERR_VALUE);
      }
    }
    default:
      return scalar(ERR_VALUE);
  }
}

function toScalarValue(r: EvalResult): FormulaValue {
  return r.kind === "scalar" ? r.value : r.rows[0]?.[0] ?? null;
}

/**
 * An operator applied across a range instead of to one value.
 *
 * `A1:A9>50` is a column of nine answers, not one, and `A1:A9*2` is nine products. Excel has
 * worked this way since dynamic arrays; before this function, both collapsed to the first cell
 * quietly — which is the worst of the three possible behaviours, because the answer looked right.
 *
 * The shape rules are Excel's, kept deliberately narrow:
 *
 * - range ∘ scalar, and scalar ∘ range, apply elementwise across the range.
 * - range ∘ range of the same shape pairs them up.
 * - range ∘ range of different shapes is `#VALUE!`. Excel broadcasts a row against a column into
 *   a rectangle; that is a bigger idea than this engine needs, and guessing would be worse than
 *   refusing.
 *
 * A one-cell range is treated as the scalar it is, so `SUM(A1:A1)+1` keeps working.
 */
function broadcast(op: string, left: EvalResult, right: EvalResult): EvalResult {
  const shape = (r: EvalResult): { h: number; w: number } | null => {
    if (r.kind === "scalar") return null;
    const h = r.rows.length;
    const w = r.rows.reduce((max, row) => Math.max(max, row.length), 0);
    return h * w <= 1 ? null : { h, w };
  };
  const at = (r: EvalResult, y: number, x: number): EvalResult =>
    r.kind === "scalar" ? r : scalar(r.rows[y]?.[x] ?? null);

  const ls = shape(left);
  const rs = shape(right);
  if (!ls && !rs) return scalar(evalBinop(op, left, right));
  if (ls && rs && (ls.h !== rs.h || ls.w !== rs.w)) return scalar(ERR_VALUE);

  const { h, w } = (ls ?? rs)!;
  const rows: FormulaValue[][] = [];
  for (let y = 0; y < h; y++) {
    const row: FormulaValue[] = [];
    for (let x = 0; x < w; x++) row.push(evalBinop(op, at(left, y, x), at(right, y, x)));
    rows.push(row);
  }
  return { kind: "range", rows, startRow: 0, startCol: 0 };
}

function evalBinop(op: string, leftR: EvalResult, rightR: EvalResult): FormulaValue {
  const left = toScalarValue(leftR);
  const right = toScalarValue(rightR);

  if (op === "&") {
    if (isError(left)) return left;
    if (isError(right)) return right;
    return toDisplayString(left) + toDisplayString(right);
  }

  if (["=", "<>", "<", ">", "<=", ">="].includes(op)) {
    if (isError(left)) return left;
    if (isError(right)) return right;
    let cmp: number;
    if (typeof left === "number" && typeof right === "number") {
      cmp = left - right;
    } else {
      const ls = toDisplayString(left).toLowerCase();
      const rs = toDisplayString(right).toLowerCase();
      cmp = ls < rs ? -1 : ls > rs ? 1 : 0;
    }
    switch (op) {
      case "=":
        return cmp === 0;
      case "<>":
        return cmp !== 0;
      case "<":
        return cmp < 0;
      case ">":
        return cmp > 0;
      case "<=":
        return cmp <= 0;
      case ">=":
        return cmp >= 0;
    }
  }

  const ln = toNumber(left);
  if (isError(ln)) return ln;
  const rn = toNumber(right);
  if (isError(rn)) return rn;
  switch (op) {
    case "+":
      return ln + rn;
    case "-":
      return ln - rn;
    case "*":
      return ln * rn;
    case "/":
      return rn === 0 ? ERR_DIV0 : ln / rn;
    case "^":
      return Math.pow(ln, rn);
    default:
      return ERR_VALUE;
  }
}
