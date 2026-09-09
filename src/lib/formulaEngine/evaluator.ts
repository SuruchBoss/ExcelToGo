import { AstNode } from "./ast";
import { EvalResult, FormulaValue, isError, scalar, ERR_DIV0, ERR_NAME, ERR_REF, ERR_VALUE } from "./types";
import { toNumber, toDisplayString } from "./coerce";
import { FUNCTIONS } from "./functions";

export interface EvalContext {
  getCell(row: number, col: number): FormulaValue;
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
      return scalar(ctx.getCell(node.row, node.col));
    case "referror":
      return scalar(ERR_REF);
    case "range": {
      const rows: FormulaValue[][] = [];
      for (let r = node.startRow; r <= node.endRow; r++) {
        const row: FormulaValue[] = [];
        for (let c = node.startCol; c <= node.endCol; c++) {
          row.push(ctx.getCell(r, c));
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
      return scalar(evalBinop(node.op, evaluate(node.left, ctx), evaluate(node.right, ctx)));
    case "call": {
      const fn = FUNCTIONS[node.name];
      if (!fn) return scalar(ERR_NAME);
      const args = node.args.map((a) => evaluate(a, ctx));
      try {
        return scalar(fn(args));
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
