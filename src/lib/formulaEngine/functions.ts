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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Turns an Excel criteria pattern into a regular expression, or null when it holds no wildcard.
 *
 * `*` stands for any run of characters and `?` for exactly one, and `~` escapes either (so `~*`
 * matches a literal asterisk). Returning null for a plain string keeps the common case on the
 * cheaper equality path.
 */
function wildcardToRegExp(pattern: string): RegExp | null {
  // Any of the three is enough to need compiling: an escape has to be unwrapped even when the
  // pattern holds no live wildcard, or "10~*20" would be compared literally, tilde and all.
  if (!/[*?~]/.test(pattern)) return null;
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "~" && (pattern[i + 1] === "*" || pattern[i + 1] === "?" || pattern[i + 1] === "~")) {
      out += escapeRegExp(pattern[++i]);
    } else if (ch === "*") {
      out += "[\\s\\S]*";
    } else if (ch === "?") {
      out += "[\\s\\S]";
    } else {
      out += escapeRegExp(ch);
    }
  }
  return new RegExp(`^${out}$`, "iu");
}

/** Compares a cell against a text criteria, honouring wildcards. Case-insensitive either way,
 *  which is how Excel treats text criteria. */
function textMatches(value: FormulaValue, pattern: string): boolean {
  const text = toDisplayString(value);
  const re = wildcardToRegExp(pattern);
  return re ? re.test(text) : text.toLowerCase() === pattern.toLowerCase();
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
    if (op === "=") return textMatches(value, rhsRaw);
    if (op === "<>") return !textMatches(value, rhsRaw);
    return false;
  }
  const numCriteria = Number(critStr);
  if (!Number.isNaN(numCriteria) && critStr !== "") {
    const n = toNumber(value);
    return !isError(n) && n === numCriteria;
  }
  return textMatches(value, critStr);
}

/**
 * Flattens a range that is one row or one column into a list, keeping its order.
 *
 * MATCH is defined over a one-dimensional range; a block like A1:C5 has no single "position N"
 * to return, so it is refused rather than being silently flattened row-major into an answer that
 * would look plausible and mean nothing.
 */
function toVector(rows: FormulaValue[][]): FormulaValue[] | null {
  if (rows.length === 0) return null;
  if (rows.length === 1) return [...rows[0]];
  if (rows.every((r) => r.length === 1)) return rows.map((r) => r[0]);
  return null;
}

function sameShape(a: FormulaValue[][], b: FormulaValue[][]): boolean {
  return a.length === b.length && a.every((row, i) => row.length === b[i].length);
}

function requireRange(arg: EvalResult): FormulaValue[][] {
  if (arg.kind === "range") return arg.rows;
  return [[arg.value]];
}

/**
 * Most functions answer with a single value. INDEX is the exception: `INDEX(A1:C5, 0, 2)` means
 * "all of column 2", which only means something if a function can hand a range back for SUM or
 * another function to consume. So an implementation may return either.
 */
type FnImpl = (args: EvalResult[]) => FormulaValue | EvalResult;

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
  /**
   * MATCH(lookup, range, [match_type]) — the position of a value within a one-dimensional range.
   *
   * Paired with INDEX this replaces VLOOKUP without VLOOKUP's two weaknesses: the lookup column
   * doesn't have to be the leftmost one, and inserting a column doesn't silently break a hard-coded
   * column number.
   */
  MATCH: (args) => {
    const lookup = scalarOf(args[0]);
    if (isError(lookup)) return lookup;
    const vector = toVector(requireRange(args[1]));
    if (!vector) return ERR_NA;
    const typeArg = args[2] ? toNumber(scalarOf(args[2])) : 1;
    if (isError(typeArg)) return typeArg;
    const matchType = typeArg > 0 ? 1 : typeArg < 0 ? -1 : 0;

    const lookupNum = toNumber(lookup);
    const lookupIsNum = !isError(lookupNum);
    const lookupText = toDisplayString(lookup).toLowerCase();

    if (matchType === 0) {
      for (let i = 0; i < vector.length; i++) {
        const v = vector[i];
        if (isError(v)) continue;
        if (lookupIsNum && typeof v !== "string") {
          const n = toNumber(v);
          if (!isError(n) && n === lookupNum) return i + 1;
          continue;
        }
        if (toDisplayString(v).toLowerCase() === lookupText) return i + 1;
      }
      return ERR_NA;
    }

    // Approximate match walks the range and keeps the last value on the right side of the
    // lookup. Excel assumes the range is sorted and gives a wrong answer when it isn't; doing
    // the same here would be a silent wrong number, so the walk stops at the first value that
    // breaks the expected order.
    let best: number | null = null;
    for (let i = 0; i < vector.length; i++) {
      const v = vector[i];
      if (isBlank(v) || isError(v)) continue;
      let cmp: number;
      if (lookupIsNum && typeof v !== "string") {
        const n = toNumber(v);
        if (isError(n)) continue;
        cmp = n === lookupNum ? 0 : n < lookupNum ? -1 : 1;
      } else {
        const text = toDisplayString(v).toLowerCase();
        cmp = text === lookupText ? 0 : text < lookupText ? -1 : 1;
      }
      if (cmp === 0) return i + 1;
      if (matchType === 1 && cmp < 0) best = i + 1;
      if (matchType === 1 && cmp > 0) break;
      if (matchType === -1 && cmp > 0) best = i + 1;
      if (matchType === -1 && cmp < 0) break;
    }
    return best ?? ERR_NA;
  },
  /**
   * INDEX(range, row_num, [col_num]) — the value at a position inside a range.
   *
   * A row or column number of 0 means "the whole of it", which is why this may return a range.
   * For a range that is a single row or column, one index is enough and it counts along that
   * line, matching how people actually write `INDEX(A1:A20, MATCH(...))`.
   */
  INDEX: (args) => {
    const rows = requireRange(args[0]);
    if (rows.length === 0) return ERR_REF_LOCAL;
    const height = rows.length;
    const width = Math.max(...rows.map((r) => r.length));

    const firstArg = args[1] ? toNumber(scalarOf(args[1])) : 0;
    if (isError(firstArg)) return firstArg;
    const secondArg = args[2] ? toNumber(scalarOf(args[2])) : null;
    if (secondArg !== null && isError(secondArg)) return secondArg;

    let rowNum = Math.trunc(firstArg);
    let colNum = secondArg === null ? 0 : Math.trunc(secondArg);
    // One index into a single-row range counts across it, not down it.
    if (secondArg === null && height === 1 && width > 1) {
      colNum = rowNum;
      rowNum = 1;
    }
    if (rowNum < 0 || colNum < 0 || rowNum > height || colNum > width) return ERR_REF_LOCAL;

    if (rowNum === 0 && colNum === 0) return { kind: "range", rows, startRow: 0, startCol: 0 };
    if (rowNum === 0) {
      const column = rows.map((r) => [r[colNum - 1] ?? null]);
      return { kind: "range", rows: column, startRow: 0, startCol: 0 };
    }
    if (colNum === 0) return { kind: "range", rows: [[...(rows[rowNum - 1] ?? [])]], startRow: 0, startCol: 0 };
    return rows[rowNum - 1]?.[colNum - 1] ?? null;
  },
  /**
   * SUMIFS(sum_range, criteria_range1, criteria1, …) — sums the cells meeting every condition.
   *
   * Note the argument order is not SUMIF's: the range being summed comes first here and last
   * there. That is Excel's own inconsistency, kept because a formula copied out of a real
   * workbook has to behave the same way here.
   */
  /**
   * COUNTIFS(criteria_range1, criteria1, …) — counts the cells meeting every condition.
   *
   * Unlike SUMIFS there is no separate range to aggregate: the first criteria range is both the
   * thing being tested and the thing being counted, so the pairs start at the first argument.
   */
  COUNTIFS: (args) => {
    if (args.length === 0) return ERR_VALUE;
    const shape = requireRange(args[0]);
    const pairs = criteriaPairs(args, shape, 0);
    if (isError(pairs)) return pairs;
    let count = 0;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (pairs.every(({ range, criteria }) => matchCriteria(range[r]?.[c] ?? null, criteria))) count++;
      }
    }
    return count;
  },
  /** AVERAGEIFS(average_range, criteria_range1, criteria1, …) — argument order follows SUMIFS. */
  AVERAGEIFS: (args) => {
    const target = requireRange(args[0]);
    const pairs = criteriaPairs(args, target);
    if (isError(pairs)) return pairs;
    let total = 0;
    let count = 0;
    for (let r = 0; r < target.length; r++) {
      for (let c = 0; c < target[r].length; c++) {
        if (!pairs.every(({ range, criteria }) => matchCriteria(range[r]?.[c] ?? null, criteria))) continue;
        const v = target[r][c];
        // Blanks and text inside the averaged range are skipped rather than counted as zero,
        // which would drag the average down towards it.
        if (isBlank(v) || typeof v === "string") continue;
        const n = toNumber(v);
        if (!isError(n)) {
          total += n;
          count++;
        }
      }
    }
    if (count === 0) return ERR_DIV0;
    return total / count;
  },
  SUMIFS: (args) => {
    const target = requireRange(args[0]);
    const pairs = criteriaPairs(args, target);
    if (isError(pairs)) return pairs;
    let total = 0;
    for (let r = 0; r < target.length; r++) {
      for (let c = 0; c < target[r].length; c++) {
        if (!pairs.every(({ range, criteria }) => matchCriteria(range[r]?.[c] ?? null, criteria))) continue;
        const n = toNumber(target[r][c] ?? 0);
        if (!isError(n)) total += n;
      }
    }
    return total;
  },
};

/**
 * Reads the (range, criteria) argument pairs of a *IFS function and checks each range lines up
 * with the range being aggregated.
 *
 * Excel refuses mismatched shapes with #VALUE! rather than lining them up from the top-left,
 * because a criteria range one row short would otherwise test the wrong row for every cell after
 * it — a wrong total that looks entirely reasonable.
 */
function criteriaPairs(
  args: EvalResult[],
  target: FormulaValue[][],
  start = 1
): { range: FormulaValue[][]; criteria: FormulaValue }[] | FormulaError {
  if (args.length < start + 2 || (args.length - start) % 2 !== 0) return ERR_VALUE;
  const pairs: { range: FormulaValue[][]; criteria: FormulaValue }[] = [];
  for (let i = start; i < args.length; i += 2) {
    const range = requireRange(args[i]);
    if (!sameShape(range, target)) return ERR_VALUE;
    const criteria = scalarOf(args[i + 1]);
    if (isError(criteria)) return criteria;
    pairs.push({ range, criteria });
  }
  return pairs;
}

const ERR_REF_LOCAL = new FormulaError("#REF!");

function scalarOf(arg: EvalResult | undefined): FormulaValue {
  if (!arg) return null;
  if (arg.kind === "scalar") return arg.value;
  return arg.rows[0]?.[0] ?? null;
}
