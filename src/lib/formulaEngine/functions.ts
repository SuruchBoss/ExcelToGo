import { EvalResult, FormulaError, FormulaValue, flattenResult, isError, ERR_DIV0, ERR_NA, ERR_VALUE } from "./types";
import { toBoolean, toDisplayString, toNumber, isBlank } from "./coerce";

// SUM/AVERAGE/MIN/MAX etc. silently ignore text and blanks found inside a
// range (matching Excel), but still propagate a genuine formula error and
// still reject a non-numeric value passed directly as a scalar argument.
function flattenNumbers(args: EvalResult[]): number[] | FormulaError {
  const out: number[] = [];
  for (const arg of args) {
    const isRange = arg.kind === "range";
    for (const v of flattenResult(arg)) {
      if (isBlank(v)) continue;
      if (isError(v)) return v;
      if (isRange && typeof v === "string") {
        const n = Number(v.trim());
        if (!Number.isNaN(v.trim() === "" ? NaN : n)) out.push(n);
        continue;
      }
      const n = toNumber(v);
      if (isError(n)) return n;
      out.push(n);
    }
  }
  return out;
}

function firstError(values: FormulaValue[]): FormulaError | null {
  for (const v of values) if (isError(v)) return v;
  return null;
}

function matchCriteria(value: FormulaValue, criteria: FormulaValue): boolean {
  const critStr = toDisplayString(criteria).trim();
  const m = /^(<>|>=|<=|>|<|=)(.*)$/.exec(critStr);
  if (m) {
    const op = m[1];
    const rhsRaw = m[2];
    const rhsNum = Number(rhsRaw);
    if (!Number.isNaN(rhsNum) && typeof value !== "string") {
      const lhsNum = toNumber(value);
      const lhs = isError(lhsNum) ? NaN : lhsNum;
      switch (op) {
        case ">":
          return lhs > rhsNum;
        case "<":
          return lhs < rhsNum;
        case ">=":
          return lhs >= rhsNum;
        case "<=":
          return lhs <= rhsNum;
        case "=":
          return lhs === rhsNum;
        case "<>":
          return lhs !== rhsNum;
      }
    }
    if (op === "=") return toDisplayString(value).toLowerCase() === rhsRaw.toLowerCase();
    if (op === "<>") return toDisplayString(value).toLowerCase() !== rhsRaw.toLowerCase();
    return false;
  }
  const numCriteria = Number(critStr);
  if (!Number.isNaN(numCriteria) && critStr !== "") {
    const n = toNumber(value);
    return !isError(n) && n === numCriteria;
  }
  return toDisplayString(value).toLowerCase() === critStr.toLowerCase();
}

function requireRange(arg: EvalResult): FormulaValue[][] {
  if (arg.kind === "range") return arg.rows;
  return [[arg.value]];
}

type FnImpl = (args: EvalResult[]) => FormulaValue;

export const FUNCTIONS: Record<string, FnImpl> = {
  SUM: (args) => {
    const nums = flattenNumbers(args);
    if (isError(nums)) return nums;
    return nums.reduce((a, b) => a + b, 0);
  },
  AVERAGE: (args) => {
    const nums = flattenNumbers(args);
    if (isError(nums)) return nums;
    if (nums.length === 0) return ERR_DIV0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  },
  COUNT: (args) => {
    let count = 0;
    for (const arg of args) {
      for (const v of flattenResult(arg)) {
        if (typeof v === "number") count++;
        else if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) count++;
      }
    }
    return count;
  },
  COUNTA: (args) => {
    let count = 0;
    for (const arg of args) {
      for (const v of flattenResult(arg)) {
        if (!isBlank(v)) count++;
      }
    }
    return count;
  },
  COUNTBLANK: (args) => {
    let count = 0;
    for (const arg of args) {
      for (const v of flattenResult(arg)) {
        if (isBlank(v)) count++;
      }
    }
    return count;
  },
  MIN: (args) => {
    const nums = flattenNumbers(args);
    if (isError(nums)) return nums;
    if (nums.length === 0) return 0;
    return Math.min(...nums);
  },
  MAX: (args) => {
    const nums = flattenNumbers(args);
    if (isError(nums)) return nums;
    if (nums.length === 0) return 0;
    return Math.max(...nums);
  },
  PRODUCT: (args) => {
    const nums = flattenNumbers(args);
    if (isError(nums)) return nums;
    return nums.reduce((a, b) => a * b, 1);
  },
  ROUND: (args) => {
    const n = toNumber(scalarOf(args[0]));
    const d = args[1] ? toNumber(scalarOf(args[1])) : 0;
    if (isError(n)) return n;
    if (isError(d)) return d;
    const factor = Math.pow(10, d);
    return Math.round(n * factor) / factor;
  },
  ROUNDUP: (args) => {
    const n = toNumber(scalarOf(args[0]));
    const d = args[1] ? toNumber(scalarOf(args[1])) : 0;
    if (isError(n) || isError(d)) return isError(n) ? n : (d as FormulaError);
    const factor = Math.pow(10, d);
    return (n >= 0 ? Math.ceil(n * factor) : Math.floor(n * factor)) / factor;
  },
  ROUNDDOWN: (args) => {
    const n = toNumber(scalarOf(args[0]));
    const d = args[1] ? toNumber(scalarOf(args[1])) : 0;
    if (isError(n) || isError(d)) return isError(n) ? n : (d as FormulaError);
    const factor = Math.pow(10, d);
    return (n >= 0 ? Math.floor(n * factor) : Math.ceil(n * factor)) / factor;
  },
  ABS: (args) => {
    const n = toNumber(scalarOf(args[0]));
    return isError(n) ? n : Math.abs(n);
  },
  SQRT: (args) => {
    const n = toNumber(scalarOf(args[0]));
    if (isError(n)) return n;
    if (n < 0) return ERR_VALUE;
    return Math.sqrt(n);
  },
  POWER: (args) => {
    const base = toNumber(scalarOf(args[0]));
    const exp = toNumber(scalarOf(args[1]));
    if (isError(base)) return base;
    if (isError(exp)) return exp;
    return Math.pow(base, exp);
  },
  MOD: (args) => {
    const a = toNumber(scalarOf(args[0]));
    const b = toNumber(scalarOf(args[1]));
    if (isError(a)) return a;
    if (isError(b)) return b;
    if (b === 0) return ERR_DIV0;
    return a - Math.floor(a / b) * b;
  },
  INT: (args) => {
    const n = toNumber(scalarOf(args[0]));
    return isError(n) ? n : Math.floor(n);
  },
  IF: (args) => {
    const cond = toBoolean(scalarOf(args[0]));
    if (isError(cond)) return cond;
    if (cond) return args[1] ? scalarOf(args[1]) : true;
    return args[2] ? scalarOf(args[2]) : false;
  },
  IFERROR: (args) => {
    const v = scalarOf(args[0]);
    return isError(v) ? scalarOf(args[1]) : v;
  },
  IFNA: (args) => {
    const v = scalarOf(args[0]);
    return isError(v) && v.code === "#N/A" ? scalarOf(args[1]) : v;
  },
  AND: (args) => {
    const values = args.flatMap((a) => flattenResult(a));
    const err = firstError(values);
    if (err) return err;
    return values.every((v) => toBoolean(v) === true);
  },
  OR: (args) => {
    const values = args.flatMap((a) => flattenResult(a));
    const err = firstError(values);
    if (err) return err;
    return values.some((v) => toBoolean(v) === true);
  },
  NOT: (args) => {
    const b = toBoolean(scalarOf(args[0]));
    return isError(b) ? b : !b;
  },
  CONCATENATE: (args) => args.flatMap((a) => flattenResult(a)).map(toDisplayString).join(""),
  CONCAT: (args) => args.flatMap((a) => flattenResult(a)).map(toDisplayString).join(""),
  UPPER: (args) => toDisplayString(scalarOf(args[0])).toUpperCase(),
  LOWER: (args) => toDisplayString(scalarOf(args[0])).toLowerCase(),
  PROPER: (args) =>
    toDisplayString(scalarOf(args[0])).replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase()),
  TRIM: (args) => toDisplayString(scalarOf(args[0])).trim().replace(/\s+/g, " "),
  LEN: (args) => toDisplayString(scalarOf(args[0])).length,
  LEFT: (args) => {
    const s = toDisplayString(scalarOf(args[0]));
    const n = args[1] ? toNumber(scalarOf(args[1])) : 1;
    if (isError(n)) return n;
    return s.slice(0, n);
  },
  RIGHT: (args) => {
    const s = toDisplayString(scalarOf(args[0]));
    const n = args[1] ? toNumber(scalarOf(args[1])) : 1;
    if (isError(n)) return n;
    return n === 0 ? "" : s.slice(-n);
  },
  MID: (args) => {
    const s = toDisplayString(scalarOf(args[0]));
    const start = toNumber(scalarOf(args[1]));
    const len = toNumber(scalarOf(args[2]));
    if (isError(start)) return start;
    if (isError(len)) return len;
    return s.slice(start - 1, start - 1 + len);
  },
  TEXT: (args) => {
    const v = scalarOf(args[0]);
    return toDisplayString(v);
  },
  TODAY: () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  },
  NOW: () => new Date().toISOString().slice(0, 16).replace("T", " "),
  YEAR: (args) => {
    const d = new Date(toDisplayString(scalarOf(args[0])));
    return Number.isNaN(d.getTime()) ? ERR_VALUE : d.getFullYear();
  },
  MONTH: (args) => {
    const d = new Date(toDisplayString(scalarOf(args[0])));
    return Number.isNaN(d.getTime()) ? ERR_VALUE : d.getMonth() + 1;
  },
  DAY: (args) => {
    const d = new Date(toDisplayString(scalarOf(args[0])));
    return Number.isNaN(d.getTime()) ? ERR_VALUE : d.getDate();
  },
  SUMIF: (args) => {
    const range = requireRange(args[0]);
    const criteria = scalarOf(args[1]);
    const sumRange = args[2] ? requireRange(args[2]) : range;
    let total = 0;
    for (let r = 0; r < range.length; r++) {
      for (let c = 0; c < range[r].length; c++) {
        if (matchCriteria(range[r][c], criteria)) {
          const target = sumRange[r]?.[c];
          const n = toNumber(target ?? 0);
          if (!isError(n)) total += n;
        }
      }
    }
    return total;
  },
  COUNTIF: (args) => {
    const range = requireRange(args[0]);
    const criteria = scalarOf(args[1]);
    let count = 0;
    for (const row of range) for (const v of row) if (matchCriteria(v, criteria)) count++;
    return count;
  },
  AVERAGEIF: (args) => {
    const range = requireRange(args[0]);
    const criteria = scalarOf(args[1]);
    const avgRange = args[2] ? requireRange(args[2]) : range;
    let total = 0;
    let count = 0;
    for (let r = 0; r < range.length; r++) {
      for (let c = 0; c < range[r].length; c++) {
        if (matchCriteria(range[r][c], criteria)) {
          const n = toNumber(avgRange[r]?.[c] ?? 0);
          if (!isError(n)) {
            total += n;
            count++;
          }
        }
      }
    }
    if (count === 0) return ERR_DIV0;
    return total / count;
  },
  VLOOKUP: (args) => {
    const lookup = scalarOf(args[0]);
    const table = requireRange(args[1]);
    const colIndex = toNumber(scalarOf(args[2]));
    if (isError(colIndex)) return colIndex;
    const rangeLookup = args[3] ? toBoolean(scalarOf(args[3])) : true;
    if (isError(rangeLookup)) return rangeLookup;
    if (colIndex < 1 || (table[0] && colIndex > table[0].length)) return ERR_REF_LOCAL;
    if (!rangeLookup) {
      for (const row of table) {
        if (toDisplayString(row[0]).toLowerCase() === toDisplayString(lookup).toLowerCase()) {
          return row[colIndex - 1] ?? ERR_NA;
        }
      }
      return ERR_NA;
    }
    let best: FormulaValue[] | null = null;
    const lookupNum = toNumber(lookup);
    for (const row of table) {
      if (isError(lookupNum)) {
        if (toDisplayString(row[0]).toLowerCase() <= toDisplayString(lookup).toLowerCase()) best = row;
        continue;
      }
      const key = toNumber(row[0]);
      if (isError(key)) continue;
      if (key <= lookupNum) best = row;
    }
    return best ? best[colIndex - 1] ?? ERR_NA : ERR_NA;
  },
};

const ERR_REF_LOCAL = new FormulaError("#REF!");

function scalarOf(arg: EvalResult | undefined): FormulaValue {
  if (!arg) return null;
  if (arg.kind === "scalar") return arg.value;
  return arg.rows[0]?.[0] ?? null;
}
