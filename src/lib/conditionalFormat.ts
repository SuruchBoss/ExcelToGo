/**
 * Conditional formatting: cell styling that follows the numbers instead of being painted on.
 *
 * The point of a spreadsheet is usually a question — which rows are over budget, which branch
 * sold least, where the outliers are. Static fills answer it once and then go stale the moment a
 * value changes. These rules are re-evaluated from computed values on every render, so the answer
 * stays true as the sheet is edited.
 *
 * Deliberately imports nothing from `sheet.ts`: SheetModel stores these rules, so a dependency
 * back the other way would be a cycle. Evaluation takes the computed values it needs instead.
 */
import { FormulaValue } from "./formulaEngine/types";

export interface CfRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export type CfComparison = "gt" | "lt" | "gte" | "lte" | "eq" | "ne" | "between";

/**
 * What a rule asks of a cell.
 *
 * `compare`/`textContains` look at one cell alone; `rank`, `colorScale` and `dataBar` need every
 * value in the range to mean anything, which is why evaluation is a whole-range pass rather than
 * a per-cell predicate.
 */
export type CfTest =
  | { kind: "compare"; op: CfComparison; value: number; value2?: number }
  | { kind: "textContains"; text: string }
  | { kind: "rank"; bottom: boolean; count: number }
  | { kind: "colorScale"; min: string; mid?: string; max: string }
  | { kind: "dataBar"; color: string };

/** What a matching cell gets. Scale and bar rules compute their own colours and ignore this. */
export interface CfStyle {
  fill?: string;
  color?: string;
  bold?: boolean;
}

export interface CfRule {
  id: string;
  range: CfRange;
  test: CfTest;
  style?: CfStyle;
}

/** The styling one cell ends up with, after every rule covering it has had its say. */
export interface CfVisual {
  fill?: string;
  color?: string;
  bold?: boolean;
  /** Proportional bar drawn behind the value, 0–1 of the cell's width. */
  bar?: { fraction: number; color: string };
}

export function inRange(range: CfRange, row: number, col: number): boolean {
  return row >= range.startRow && row <= range.endRow && col >= range.startCol && col <= range.endCol;
}

export function rangeCellCount(range: CfRange): number {
  return (range.endRow - range.startRow + 1) * (range.endCol - range.startCol + 1);
}

function numbersIn(range: CfRange, values: FormulaValue[][]): number[] {
  const out: number[] = [];
  for (let r = range.startRow; r <= range.endRow; r++) {
    for (let c = range.startCol; c <= range.endCol; c++) {
      const v = values[r]?.[c];
      if (typeof v === "number" && Number.isFinite(v)) out.push(v);
    }
  }
  return out;
}

function matchesComparison(value: number, test: Extract<CfTest, { kind: "compare" }>): boolean {
  switch (test.op) {
    case "gt":
      return value > test.value;
    case "lt":
      return value < test.value;
    case "gte":
      return value >= test.value;
    case "lte":
      return value <= test.value;
    case "eq":
      return value === test.value;
    case "ne":
      return value !== test.value;
    case "between": {
      // Accept the bounds in either order — someone typing "between 100 and 10" means the same
      // range, and refusing it would be pedantry rather than a check that protects anything.
      const lo = Math.min(test.value, test.value2 ?? test.value);
      const hi = Math.max(test.value, test.value2 ?? test.value);
      return value >= lo && value <= hi;
    }
  }
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: [number, number, number]): string {
  return "#" + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
}

/** Linear blend between two colours; `t` is clamped to 0–1. Invalid input falls back to `from`. */
export function mixColors(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  if (!a || !b) return from;
  const k = Math.min(1, Math.max(0, t));
  return toHex([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]);
}

/**
 * Position of `value` between `min` and `max`, 0–1.
 *
 * When every value in the range is identical there is no spread to place anything along, so the
 * whole range sits at the top: a column of equal numbers reads as "all the same", which is truer
 * than the alternative of painting them all as the minimum.
 */
function fraction(value: number, min: number, max: number): number {
  if (max <= min) return 1;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function colorScaleFor(value: number, nums: number[], test: Extract<CfTest, { kind: "colorScale" }>): string {
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const t = fraction(value, min, max);
  if (!test.mid) return mixColors(test.min, test.max, t);
  // Three stops split at the midpoint of the value range (Excel's "percent 50" default), so the
  // middle colour marks the middle of the spread rather than the median row.
  return t <= 0.5 ? mixColors(test.min, test.mid, t * 2) : mixColors(test.mid, test.max, (t - 0.5) * 2);
}

/**
 * Threshold a value must reach to be in the top (or bottom) `count` of the range.
 *
 * Ties are included rather than cut off arbitrarily: asking for the top 3 of `10, 10, 10, 1`
 * highlights all three tens. Cutting one of them would be a lie about the data.
 */
function rankThreshold(nums: number[], test: Extract<CfTest, { kind: "rank" }>): number | null {
  if (nums.length === 0 || test.count <= 0) return null;
  const sorted = [...nums].sort((a, b) => (test.bottom ? a - b : b - a));
  return sorted[Math.min(test.count, sorted.length) - 1];
}

/**
 * Applies every rule to the grid and returns per-cell styling, or `undefined` where no rule
 * matched.
 *
 * Rules are applied in list order and a later rule overrides an earlier one property by property.
 * That way a rule just added always shows its effect — the opposite convention (first match wins,
 * as in Excel's priority list) makes a newly added rule silently do nothing, which reads as the
 * feature being broken.
 */
export function evaluateConditionalFormats(
  rules: CfRule[] | undefined,
  values: FormulaValue[][],
  rows: number,
  cols: number
): (CfVisual | undefined)[][] {
  const grid: (CfVisual | undefined)[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => undefined));
  if (!rules || rules.length === 0) return grid;

  for (const rule of rules) {
    const { range, test } = rule;
    // Range-wide statistics are computed once per rule, not once per cell.
    const nums = test.kind === "rank" || test.kind === "colorScale" || test.kind === "dataBar" ? numbersIn(range, values) : [];
    const threshold = test.kind === "rank" ? rankThreshold(nums, test) : null;
    // A bar's length is measured from zero when the data includes negatives or starts above it,
    // so bars stay comparable to each other instead of to an arbitrary floor.
    const barBase = test.kind === "dataBar" && nums.length > 0 ? Math.min(0, ...nums) : 0;
    const barTop = test.kind === "dataBar" && nums.length > 0 ? Math.max(...nums) : 0;

    for (let r = Math.max(0, range.startRow); r <= Math.min(rows - 1, range.endRow); r++) {
      for (let c = Math.max(0, range.startCol); c <= Math.min(cols - 1, range.endCol); c++) {
        const v = values[r]?.[c];
        const num = typeof v === "number" && Number.isFinite(v) ? v : null;
        let visual: CfVisual | null = null;

        switch (test.kind) {
          case "compare":
            if (num !== null && matchesComparison(num, test)) visual = { ...rule.style };
            break;
          case "textContains": {
            if (test.text === "") break;
            const text = v === null || v === undefined ? "" : String(v);
            if (text.toLowerCase().includes(test.text.toLowerCase())) visual = { ...rule.style };
            break;
          }
          case "rank":
            if (num === null || threshold === null) break;
            if (test.bottom ? num <= threshold : num >= threshold) visual = { ...rule.style };
            break;
          case "colorScale":
            if (num === null || nums.length === 0) break;
            visual = { fill: colorScaleFor(num, nums, test) };
            break;
          case "dataBar":
            if (num === null || nums.length === 0) break;
            visual = { bar: { fraction: fraction(num, barBase, barTop), color: test.color } };
            break;
        }

        if (!visual) continue;
        const prev = grid[r][c];
        // Merge rather than replace: a colour-scale rule under a "make the total bold" rule should
        // leave the bold alone, the way two rules in Excel both take effect when they don't clash.
        grid[r][c] = {
          fill: visual.fill ?? prev?.fill,
          color: visual.color ?? prev?.color,
          bold: visual.bold ?? prev?.bold,
          bar: visual.bar ?? prev?.bar,
        };
      }
    }
  }
  return grid;
}

/**
 * Moves rule ranges to follow an inserted or deleted row/column, dropping a rule whose range the
 * deletion removed entirely.
 *
 * Looks like `shiftMerges` but must not share it: a merge that collapses to a single cell is junk
 * and gets dropped, while a single-cell conditional rule is perfectly ordinary and dropping it
 * would silently delete the user's rule.
 */
export function shiftConditionalRules(
  rules: CfRule[] | undefined,
  axis: "row" | "col",
  index: number,
  delta: 1 | -1
): CfRule[] | undefined {
  if (!rules || rules.length === 0) return rules;

  const out: CfRule[] = [];
  for (const rule of rules) {
    const start = axis === "row" ? rule.range.startRow : rule.range.startCol;
    const end = axis === "row" ? rule.range.endRow : rule.range.endCol;

    let nextStart = start;
    let nextEnd = end;
    if (delta === 1) {
      if (start >= index) nextStart = start + 1;
      if (end >= index) nextEnd = end + 1;
    } else {
      if (start > index) nextStart = start - 1;
      if (end >= index) nextEnd = end - 1;
    }
    // Only when the range has no lines left at all does the rule cease to mean anything.
    if (nextEnd < nextStart) continue;

    const range: CfRange =
      axis === "row"
        ? { ...rule.range, startRow: nextStart, endRow: nextEnd }
        : { ...rule.range, startCol: nextStart, endCol: nextEnd };
    out.push({ ...rule, range });
  }
  return out.length > 0 ? out : undefined;
}

/** Default colours for a new rule, picked to stay legible against black text. */
export const CF_PRESET_STYLES: { id: string; style: CfStyle }[] = [
  { id: "red", style: { fill: "#fee2e2", color: "#991b1b" } },
  { id: "amber", style: { fill: "#fef3c7", color: "#92400e" } },
  { id: "green", style: { fill: "#dcfce7", color: "#166534" } },
  { id: "blue", style: { fill: "#dbeafe", color: "#1e40af" } },
];

export const CF_SCALE_PRESETS = {
  redGreen: { min: "#fca5a5", mid: "#fde68a", max: "#86efac" },
  greenRed: { min: "#86efac", mid: "#fde68a", max: "#fca5a5" },
  whiteBlue: { min: "#ffffff", max: "#93c5fd" },
} as const;

export const CF_BAR_COLOR = "#6ee7b7";
