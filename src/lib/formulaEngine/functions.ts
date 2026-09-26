// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { EvalResult, FormulaError, FormulaValue, flattenResult, isError, ERR_DIV0, ERR_NA, ERR_NUM, ERR_VALUE } from "./types";
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
      // A logical value sitting in a *cell* is ignored, exactly as Excel does: `SUM(A1:A3)` over
      // 1, TRUE, 2 is 3, not 4. Passed directly it still counts — `SUM(1,TRUE,2)` is 4 — which is
      // why this tests the source and not just the type. Found by the property tests.
      if (isRange && typeof v === "boolean") continue;
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

/**
 * Reads a date out of a cell, always as an instant at UTC.
 *
 * `new Date("2024-01-15")` is UTC midnight, but `.getDate()` reads it back in the local zone: west
 * of UTC that gives the 14th. Every date function here used to do exactly that, so DAY of a date
 * typed by hand was a day out for anyone in the Americas. Parsing the plain forms into UTC and
 * reading them back with the UTC accessors keeps a date the day it says it is, wherever it is read.
 */
function parseDateValue(v: FormulaValue): Date | null {
  if (v instanceof Date) return v;
  const text = toDisplayString(v).trim();
  if (text === "") return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(text);
  if (iso) {
    const [, y, m, d, hh, mm] = iso;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0)));
    // Date.UTC rolls 2024-02-31 over into March rather than rejecting it; Excel treats a date that
    // doesn't exist as an error, and so should this.
    if (date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return null;
    return date;
  }
  const loose = new Date(text);
  return Number.isNaN(loose.getTime()) ? null : loose;
}

/** Whole months from one date to another, counting only months that have fully elapsed. */
function monthsBetween(from: Date, to: Date): number {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

/**
 * An optional argument, or undefined when it was left out.
 *
 * `XLOOKUP(a,b,c,,-1)` parses the skipped slot as a blank, so "was it given?" cannot be `args[3] ?`
 * any more. A blank written out in full is read as omitted too — Excel distinguishes them, but only
 * in corners nobody writes on purpose, and falling back to the documented default is the safer of
 * the two readings.
 */
function optional(arg: EvalResult | undefined): EvalResult | undefined {
  if (!arg) return undefined;
  if (arg.kind === "scalar" && isBlank(arg.value)) return undefined;
  return arg;
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

/**
 * The dynamic-array functions: the ones whose answer is a shape, not a number.
 *
 * They exist together because they are useless apart. A function that returns a whole grid needs
 * somewhere to put it, and that is `sheetCompute`'s spill: the cell holding the formula shows the
 * top-left value and the rest lands in the cells beside it. Until spilling existed, `INDEX(A1:C5,
 * 0, 2)` was the only range-returning function here and its result was truncated to one cell by
 * every caller that was not another function.
 *
 * `startRow`/`startCol` are 0 on everything built here, the same as INDEX: these arrays are made
 * up rather than read out of the grid, so they have no origin in it. Nothing reads those fields
 * off a synthesised range — checked, not assumed.
 */

/** A rectangle, padded to the widest row, so every consumer can index it without bounds checks. */
function rectangleOf(arg: EvalResult | undefined): FormulaValue[][] {
  if (!arg) return [];
  const rows = requireRange(arg);
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  return rows.map((r) => Array.from({ length: width }, (_, c) => r[c] ?? null));
}

const asRange = (rows: FormulaValue[][]): EvalResult => ({ kind: "range", rows, startRow: 0, startCol: 0 });

/** Excel compares by value across a whole row, and so does this: same key, same row. */
function rowKey(row: FormulaValue[]): string {
  return row.map((v) => (v === null ? "\u0000" : `${typeof v}:${String(v)}`)).join("\u0001");
}

const ARRAY_FUNCTIONS: Record<string, FnImpl> = {
  /** TRANSPOSE(range) — turns rows into columns. */
  TRANSPOSE: (args) => {
    const rows = rectangleOf(args[0]);
    if (rows.length === 0) return ERR_VALUE;
    const width = rows[0].length;
    return asRange(Array.from({ length: width }, (_, c) => rows.map((r) => r[c])));
  },

  /** SEQUENCE(rows, [cols], [start], [step]) — a counted grid, with no source range at all. */
  SEQUENCE: (args) => {
    const height = toNumber(scalarOf(args[0]));
    if (isError(height)) return height;
    const width = args[1] ? toNumber(scalarOf(args[1])) : 1;
    if (isError(width)) return width;
    const start = args[2] ? toNumber(scalarOf(args[2])) : 1;
    if (isError(start)) return start;
    const step = args[3] ? toNumber(scalarOf(args[3])) : 1;
    if (isError(step)) return step;

    const h = Math.trunc(height);
    const w = Math.trunc(width);
    // A guard rather than a preference: a typo like SEQUENCE(1000000) would otherwise build an
    // array big enough to take the tab down before the spill check ever got to refuse it.
    if (h < 1 || w < 1 || h * w > 50_000) return ERR_NUM;
    return asRange(Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => start + (r * w + c) * step)));
  },

  /** UNIQUE(range) — the distinct rows, in the order they first appear. */
  UNIQUE: (args) => {
    const rows = rectangleOf(args[0]);
    if (rows.length === 0) return ERR_VALUE;
    const seen = new Set<string>();
    const out: FormulaValue[][] = [];
    for (const row of rows) {
      const key = rowKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    return asRange(out);
  },

  /**
   * SORT(range, [column], [ascending]) — sorted rows, numbers before text, blanks last.
   *
   * The comparison is shared with nothing: `sheetSort.ts` sorts a live sheet by rewriting cells,
   * which is a different job with different rules (it keeps a header row in place). Making one
   * serve both would tangle a pure function with a model edit.
   */
  SORT: (args) => {
    const rows = rectangleOf(args[0]);
    if (rows.length === 0) return ERR_VALUE;
    const col = args[1] ? toNumber(scalarOf(args[1])) : 1;
    if (isError(col)) return col;
    const index = Math.trunc(col) - 1;
    if (index < 0 || index >= rows[0].length) return ERR_VALUE;
    const ascending = args[2] ? toBoolean(scalarOf(args[2])) : true;
    if (isError(ascending)) return ascending;

    const rank = (v: FormulaValue): [number, number | string] => {
      if (isBlank(v)) return [2, 0];
      if (typeof v === "number") return [0, v];
      if (typeof v === "boolean") return [1, v ? 1 : 0];
      return [1, toDisplayString(v)];
    };

    const sorted = [...rows].sort((a, b) => {
      const [ga, va] = rank(a[index]);
      const [gb, vb] = rank(b[index]);
      if (ga !== gb) return ga - gb;
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "th");
      return ascending ? cmp : -cmp;
    });
    return asRange(sorted);
  },

  /**
   * FILTER(range, include, [if_empty]) — the rows whose matching entry in `include` is true.
   *
   * `include` is normally a column of comparisons (`A1:A9>50`), which this engine evaluates to a
   * range of booleans. A mismatched height is `#VALUE!` rather than a silent truncation: quietly
   * filtering by the wrong rows is the failure nobody would notice.
   */
  FILTER: (args) => {
    const rows = rectangleOf(args[0]);
    const include = rectangleOf(args[1]);
    if (rows.length === 0 || include.length === 0) return ERR_VALUE;
    if (include.length !== rows.length) return ERR_VALUE;

    const kept = rows.filter((_, i) => {
      const flag = include[i][0];
      if (isError(flag)) return false;
      const b = toBoolean(flag);
      return !isError(b) && b;
    });
    if (kept.length > 0) return asRange(kept);
    return args[2] ? scalarOf(args[2]) : ERR_NA;
  },
};

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

  // ── Added because the assistant kept asking for them ──────────────────────────────────────
  //
  // Run against the real model, fourteen ordinary questions produced six formulas this engine had
  // no function for. Telling the model to stay inside the list was the honest fix and a poor one:
  // "join these names with commas" came back as a warning that the app cannot do it. For the
  // feature the landing page leads with, the answer is to be able to do it.
  //
  // Each of these is here because a real question reached for it, not because the Excel reference
  // has it.

  /** `TEXTJOIN(", ", TRUE, A2:A20)` — the one the assistant asked for most. */
  TEXTJOIN: (args) => {
    const delimiter = toDisplayString(scalarOf(args[0]));
    const ignoreEmpty = toBoolean(scalarOf(args[1]));
    if (isError(ignoreEmpty)) return ignoreEmpty;
    const parts: string[] = [];
    for (const arg of args.slice(2)) {
      for (const v of flattenResult(arg)) {
        if (isError(v)) return v;
        if (ignoreEmpty && isBlank(v)) continue;
        parts.push(toDisplayString(v));
      }
    }
    return parts.join(delimiter);
  },

  /** 1-based like Excel, and `#VALUE!` rather than 0 when the text isn't there. */
  FIND: (args) => findIn(args, true),
  /** FIND that ignores case. Excel's SEARCH also takes wildcards; this one does not. */
  SEARCH: (args) => findIn(args, false),

  SUBSTITUTE: (args) => {
    const text = toDisplayString(scalarOf(args[0]));
    const from = toDisplayString(scalarOf(args[1]));
    const to = toDisplayString(scalarOf(args[2]));
    if (from === "") return text;
    if (!args[3]) return text.split(from).join(to);
    const which = toNumber(scalarOf(args[3]));
    if (isError(which)) return which;
    if (which < 1) return ERR_VALUE;
    // Only the nth occurrence, which is what the fourth argument is for.
    let seen = 0;
    let at = text.indexOf(from);
    while (at !== -1) {
      if (++seen === Math.trunc(which)) return text.slice(0, at) + to + text.slice(at + from.length);
      at = text.indexOf(from, at + from.length);
    }
    return text;
  },

  CHAR: (args) => {
    const code = toNumber(scalarOf(args[0]));
    if (isError(code)) return code;
    const n = Math.trunc(code);
    // Excel's range. CHAR(10) is the line break people actually want.
    if (n < 1 || n > 255) return ERR_VALUE;
    return String.fromCharCode(n);
  },
  CODE: (args) => {
    const text = toDisplayString(scalarOf(args[0]));
    if (text === "") return ERR_VALUE;
    return text.charCodeAt(0);
  },

  CEILING: (args) => roundToStep(args, "up"),
  FLOOR: (args) => roundToStep(args, "down"),

  /**
   * Element-wise product of matching cells, summed.
   *
   * Text and blanks count as zero, as in Excel. Note the limit: `SUMPRODUCT(1/COUNTIF(...))` — the
   * classic unique-count trick — needs array arithmetic this evaluator does not do, so it still
   * will not work. What does work is the ordinary use, `SUMPRODUCT(qty, price)`.
   */
  SUMPRODUCT: (args) => {
    if (args.length === 0) return ERR_VALUE;
    const grids = args.map(requireRange);
    const rows = grids[0].length;
    const cols = grids[0][0]?.length ?? 0;
    for (const g of grids) {
      if (g.length !== rows || (g[0]?.length ?? 0) !== cols) return ERR_VALUE;
    }
    let total = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let product = 1;
        for (const g of grids) {
          const v = g[r]?.[c] ?? null;
          if (isError(v)) return v;
          product *= numericOrZero(v);
        }
        total += product;
      }
    }
    return total;
  },

  /** `RANK(D2, $D$2:$D$50)` — and the modern spelling, which is what the assistant writes. */
  RANK: (args) => rankIn(args),
  "RANK.EQ": (args) => rankIn(args),

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
    const d = parseDateValue(scalarOf(args[0]));
    return d ? d.getUTCFullYear() : ERR_VALUE;
  },
  MONTH: (args) => {
    const d = parseDateValue(scalarOf(args[0]));
    return d ? d.getUTCMonth() + 1 : ERR_VALUE;
  },
  DAY: (args) => {
    const d = parseDateValue(scalarOf(args[0]));
    return d ? d.getUTCDate() : ERR_VALUE;
  },
  /**
   * DATEDIF(start, end, unit) — the gap between two dates, in whole units.
   *
   * "Y", "M" and "D" are whole years, months and days. The three odd ones are what make it worth
   * having: "MD" is the days ignoring months and years, "YM" the months ignoring years, and "YD"
   * the days ignoring years — between them they say "3 years, 2 months and 5 days" without three
   * different subtractions.
   *
   * An end before the start is #NUM!, as in Excel: it is a mistake in the sheet, and returning a
   * negative age would hide it.
   */
  DATEDIF: (args) => {
    const start = parseDateValue(scalarOf(args[0]));
    const end = parseDateValue(scalarOf(args[1]));
    if (!start || !end) return ERR_VALUE;
    if (end.getTime() < start.getTime()) return ERR_NUM;
    const unit = toDisplayString(scalarOf(args[2])).trim().toUpperCase();
    switch (unit) {
      case "D":
        return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
      case "M":
        return monthsBetween(start, end);
      case "Y":
        return Math.floor(monthsBetween(start, end) / 12);
      case "YM":
        return monthsBetween(start, end) % 12;
      case "MD": {
        // Days since the start's day-of-month last came round. Subtracting the two day numbers and
        // borrowing the previous month's length gives -1 for 31 Jan → 1 Mar, because January's 31st
        // has no counterpart in February at all. Landing on the anniversary date itself — clamped
        // to the month's last day where that day doesn't exist — is what makes it 1.
        const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        const year = end.getUTCDate() >= start.getUTCDate() ? end.getUTCFullYear() : end.getUTCMonth() === 0 ? end.getUTCFullYear() - 1 : end.getUTCFullYear();
        const month = end.getUTCDate() >= start.getUTCDate() ? end.getUTCMonth() : (end.getUTCMonth() + 11) % 12;
        const day = Math.min(start.getUTCDate(), monthEnd(year, month));
        return Math.round((end.getTime() - Date.UTC(year, month, day)) / MS_PER_DAY);
      }
      case "YD": {
        // The start moved forward to the anniversary that falls on or before the end date.
        const sameYear = new Date(Date.UTC(end.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
        const from = sameYear.getTime() > end.getTime()
          ? new Date(Date.UTC(end.getUTCFullYear() - 1, start.getUTCMonth(), start.getUTCDate()))
          : sameYear;
        return Math.floor((end.getTime() - from.getTime()) / MS_PER_DAY);
      }
      default:
        return ERR_NUM;
    }
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
   * XLOOKUP(lookup, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])
   *
   * What VLOOKUP should have been: the two arrays are named separately, so the key doesn't have to
   * be the leftmost column and nothing breaks when a column is inserted between them. It also says
   * what to return when nothing matches, instead of leaving #N/A to be wrapped in IFERROR — which
   * swallows real errors along with the miss.
   *
   * match_mode: 0 exact (the default, unlike VLOOKUP's), -1 exact or next smaller, 1 exact or next
   * larger, 2 wildcards. search_mode: 1 first to last (default), -1 last to first.
   *
   * Both arrays must be a single row or a single column of the same length. Excel would spill a
   * whole row out of a two-dimensional return_array; this engine has no spilling, so that is
   * refused rather than answered with the first cell and passed off as the same thing.
   */
  XLOOKUP: (args) => {
    const lookup = scalarOf(args[0]);
    if (isError(lookup)) return lookup;
    const haystack = toVector(requireRange(args[1]));
    const results = toVector(requireRange(args[2]));
    if (!haystack || !results) return ERR_VALUE;
    if (haystack.length !== results.length) return ERR_VALUE;

    const fallbackArg = optional(args[3]);
    const notFound = fallbackArg ? scalarOf(fallbackArg) : ERR_NA;
    const modeRaw = optional(args[4]);
    const modeArg = modeRaw ? toNumber(scalarOf(modeRaw)) : 0;
    if (isError(modeArg)) return modeArg;
    const searchRaw = optional(args[5]);
    const searchArg = searchRaw ? toNumber(scalarOf(searchRaw)) : 1;
    if (isError(searchArg)) return searchArg;

    const order = searchArg < 0
      ? Array.from({ length: haystack.length }, (_, i) => haystack.length - 1 - i)
      : Array.from({ length: haystack.length }, (_, i) => i);

    const lookupNum = toNumber(lookup);
    const lookupText = toDisplayString(lookup).toLowerCase();
    const exactAt = (i: number) => {
      if (!isError(lookupNum)) {
        const n = toNumber(haystack[i]);
        if (!isError(n)) return n === lookupNum;
      }
      return toDisplayString(haystack[i]).toLowerCase() === lookupText;
    };

    if (modeArg === 2) {
      const re = wildcardToRegExp(toDisplayString(lookup));
      for (const i of order) {
        const cell = toDisplayString(haystack[i]);
        if (re ? re.test(cell) : cell.toLowerCase() === lookupText) return results[i];
      }
      return notFound;
    }

    for (const i of order) if (exactAt(i)) return results[i];
    if (modeArg === 0) return notFound;

    // Nearest match: the closest candidate on the requested side, found by comparing rather than
    // by assuming the array is sorted — an unsorted array is the case VLOOKUP silently gets wrong.
    let bestIndex = -1;
    let bestKey: number | null = null;
    for (let i = 0; i < haystack.length; i++) {
      const n = toNumber(haystack[i]);
      if (isError(n) || isError(lookupNum)) continue;
      const smaller = modeArg < 0;
      if (smaller ? n > lookupNum : n < lookupNum) continue;
      if (bestKey === null || (smaller ? n > bestKey : n < bestKey)) {
        bestKey = n;
        bestIndex = i;
      }
    }
    return bestIndex >= 0 ? results[bestIndex] : notFound;
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

/** Shared by FIND and SEARCH, which differ only in whether case matters. */
function findIn(args: EvalResult[], caseSensitive: boolean): FormulaValue {
  const needleRaw = toDisplayString(scalarOf(args[0]));
  const hayRaw = toDisplayString(scalarOf(args[1]));
  const needle = caseSensitive ? needleRaw : needleRaw.toLowerCase();
  const hay = caseSensitive ? hayRaw : hayRaw.toLowerCase();

  let start = 1;
  if (args[2]) {
    const n = toNumber(scalarOf(args[2]));
    if (isError(n)) return n;
    start = Math.trunc(n);
  }
  if (start < 1 || start > hay.length + 1) return ERR_VALUE;

  const at = hay.indexOf(needle, start - 1);
  // Excel answers #VALUE! rather than 0, so a missing match can't be mistaken for a position.
  return at === -1 ? ERR_VALUE : at + 1;
}

/** CEILING and FLOOR: round away from or towards zero, to a multiple. */
function roundToStep(args: EvalResult[], direction: "up" | "down"): FormulaValue {
  const value = toNumber(scalarOf(args[0]));
  if (isError(value)) return value;
  const stepArg = args[1] ? toNumber(scalarOf(args[1])) : 1;
  if (isError(stepArg)) return stepArg;
  if (stepArg === 0) return 0;
  // Excel refuses a positive number with a negative step and vice versa.
  if (value !== 0 && Math.sign(value) !== Math.sign(stepArg)) return ERR_NUM;
  const steps = value / stepArg;
  const rounded = direction === "up" ? Math.ceil(steps) : Math.floor(steps);
  // Back through a rounding pass: 0.1-sized steps otherwise land on 4.800000000000001.
  return Number((rounded * stepArg).toPrecision(15));
}

/** Text and blanks are zero here, as they are to Excel's SUMPRODUCT. */
function numericOrZero(v: FormulaValue): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(toDisplayString(v).trim());
  return Number.isFinite(n) ? n : 0;
}

/** RANK / RANK.EQ: position within a range, ties sharing the higher place. */
function rankIn(args: EvalResult[]): FormulaValue {
  const target = toNumber(scalarOf(args[0]));
  if (isError(target)) return target;

  const numbers: number[] = [];
  for (const v of requireRange(args[1]).flat()) {
    if (isError(v)) return v;
    if (isBlank(v) || typeof v === "boolean") continue;
    const n = Number(toDisplayString(v).trim());
    if (Number.isFinite(n) && toDisplayString(v).trim() !== "") numbers.push(n);
  }

  let ascending = false;
  if (args[2]) {
    const order = toNumber(scalarOf(args[2]));
    if (isError(order)) return order;
    ascending = order !== 0;
  }

  // Excel answers #N/A for a value that is not in the range at all, rather than inventing a place.
  if (!numbers.includes(target)) return ERR_NA;
  const ahead = numbers.filter((n) => (ascending ? n < target : n > target)).length;
  return ahead + 1;
}

function scalarOf(arg: EvalResult | undefined): FormulaValue {
  if (!arg) return null;
  if (arg.kind === "scalar") return arg.value;
  return arg.rows[0]?.[0] ?? null;
}

// Added after the table is built rather than inline in it, because they are defined above it: the
// table is one object literal and these need `FnImpl` and the helpers beside them to read as a set.
Object.assign(FUNCTIONS, ARRAY_FUNCTIONS);
