import { SheetModel } from "./sheet";

/**
 * Rules a cell's contents have to satisfy, set by the person using the sheet.
 *
 * The app has had *imported* validation since templates: a protected `.xlsx` arrives with
 * dropdowns and locked cells, and `sheetTemplate.ts` reads them. What it could not do was let
 * somebody building a sheet here say "this column is one of these four things" — which is the
 * whole reason a shared sheet ends up with "เหนือ", "ภาคเหนือ", "north" and " เหนือ" in the same
 * column, and then a SUMIF that quietly counts one of them.
 *
 * Refusing the edit is the behaviour, not warning after it. A warning on a cell that already
 * contains the wrong thing is a note about a mistake; refusing the write is the mistake not
 * happening. The refusal is announced, because a keystroke that does nothing and says nothing is
 * indistinguishable from a broken keyboard.
 */

export type ValidationRule =
  | { kind: "list"; values: string[] }
  | { kind: "number"; min?: number; max?: number }
  | { kind: "length"; max: number };

/** Sparse, keyed `"r,c"` — the same convention comments and the storage codec already use. */
export type CellValidation = Record<string, ValidationRule>;

export const validationKey = (row: number, col: number) => `${row},${col}`;

export function ruleAt(sheet: SheetModel, row: number, col: number): ValidationRule | undefined {
  return sheet.validation?.[validationKey(row, col)];
}

export type Refusal = "notInList" | "notANumber" | "tooSmall" | "tooLarge" | "tooLong";

/**
 * Whether a value may go in, and if not, which rule said no.
 *
 * An empty cell always passes. Clearing a cell is not entering a wrong value, and a rule that
 * refuses deletion turns a typo into something the person cannot undo by hand.
 */
export function checkValue(rule: ValidationRule | undefined, raw: string): Refusal | null {
  if (!rule) return null;
  const value = raw.trim();
  if (value === "") return null;
  // A formula is checked on its result, which this does not have. Refusing it here would mean a
  // validated column could hold no formulas at all, which is a bigger loss than the rule is worth.
  if (value.startsWith("=")) return null;

  switch (rule.kind) {
    case "list":
      return rule.values.includes(value) ? null : "notInList";
    case "number": {
      const n = Number(value);
      if (value === "" || Number.isNaN(n)) return "notANumber";
      if (rule.min !== undefined && n < rule.min) return "tooSmall";
      if (rule.max !== undefined && n > rule.max) return "tooLarge";
      return null;
    }
    case "length":
      return value.length > rule.max ? "tooLong" : null;
  }
}

/** Applies one rule to a rectangle, or clears it when `rule` is undefined. */
export function withValidation(
  sheet: SheetModel,
  range: { startRow: number; startCol: number; endRow: number; endCol: number },
  rule: ValidationRule | undefined
): SheetModel {
  const next: CellValidation = { ...(sheet.validation ?? {}) };
  for (let r = range.startRow; r <= range.endRow; r++) {
    for (let c = range.startCol; c <= range.endCol; c++) {
      const key = validationKey(r, c);
      if (rule) next[key] = rule;
      else delete next[key];
    }
  }
  if (Object.keys(next).length === 0) {
    if (!sheet.validation) return sheet;
    const without = { ...sheet };
    delete without.validation;
    return without;
  }
  return { ...sheet, validation: next };
}

/**
 * Moves rules with the cells they are attached to.
 *
 * Same rule as comments, and for the same reason: a dropdown is about a *cell*, so a row inserted
 * above it takes the dropdown down with it. A rule left on its old index is worse than none — the
 * column looks validated and the validated cell is one row off.
 */
export function shiftValidation(
  validation: CellValidation | undefined,
  axis: "row" | "col",
  index: number,
  delta: 1 | -1
): CellValidation | undefined {
  if (!validation) return undefined;
  const next: CellValidation = {};
  for (const [key, rule] of Object.entries(validation)) {
    const [row, col] = key.split(",").map(Number);
    const along = axis === "row" ? row : col;
    if (delta === -1 && along === index) continue;
    const moved = delta === 1 ? (along >= index ? along + 1 : along) : along > index ? along - 1 : along;
    next[axis === "row" ? validationKey(moved, col) : validationKey(row, moved)] = rule;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** The dropdown's options for a cell, or none — what the grid's editor asks for. */
export function choicesAt(sheet: SheetModel, row: number, col: number): string[] | undefined {
  const rule = ruleAt(sheet, row, col);
  return rule?.kind === "list" && rule.values.length > 0 ? rule.values : undefined;
}

/**
 * Parses what somebody typed into the options box.
 *
 * Commas and newlines both, because people paste a column out of another sheet as often as they
 * type a list. Duplicates and blanks are dropped: a dropdown offering the same thing twice is a
 * dropdown somebody will file a bug about.
 */
export function parseList(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[\n,]/)) {
    const value = part.trim();
    if (value !== "") seen.add(value);
  }
  return [...seen];
}

/**
 * The shape ExcelJS uses for a cell's validation, structurally.
 *
 * Declared here rather than imported so the core library keeps no dependency on the spreadsheet
 * writer — `excelIO` is the only place that knows ExcelJS exists, and the conversion is pure
 * enough to test without it.
 */
export type ExcelValidation = {
  type: string;
  operator?: string;
  allowBlank?: boolean;
  formulae?: unknown[];
};

/** Inline lists live inside one quoted string in the file format, which has no escape for a
 *  comma and a hard 255-character cap on the whole thing. */
const INLINE_LIST_LIMIT = 255;

/**
 * A rule as Excel stores it, or `undefined` when the file format cannot hold it.
 *
 * The one case that does not survive is a list whose options contain a comma, or one long enough
 * to overrun the inline limit: Excel's answer is a range of cells elsewhere in the workbook to
 * point at, which would mean this app inventing a hidden sheet in somebody's file. Refusing to
 * write it loses the dropdown; writing it truncated loses data silently, which is worse. The
 * limit is written down in both READMEs rather than left to be discovered.
 */
export function toExcelValidation(rule: ValidationRule): ExcelValidation | undefined {
  switch (rule.kind) {
    case "list": {
      const joined = rule.values.join(",");
      if (rule.values.some((v) => v.includes(",") || v.includes('"'))) return undefined;
      if (joined.length + 2 > INLINE_LIST_LIMIT) return undefined;
      return { type: "list", allowBlank: true, formulae: [`"${joined}"`] };
    }
    case "number": {
      if (rule.min !== undefined && rule.max !== undefined)
        return { type: "decimal", operator: "between", allowBlank: true, formulae: [rule.min, rule.max] };
      if (rule.min !== undefined)
        return { type: "decimal", operator: "greaterThanOrEqual", allowBlank: true, formulae: [rule.min] };
      if (rule.max !== undefined)
        return { type: "decimal", operator: "lessThanOrEqual", allowBlank: true, formulae: [rule.max] };
      // Neither end is not a rule; the UI will not build one, and a file that carries one is
      // saying nothing.
      return undefined;
    }
    case "length":
      return { type: "textLength", operator: "lessThanOrEqual", allowBlank: true, formulae: [rule.max] };
  }
}

/** The number a formula slot holds, whether the file wrote it as a number or as text. */
function numberIn(formulae: unknown[] | undefined, at: number): number | undefined {
  const raw = formulae?.[at];
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== "string") return undefined;
  const n = Number(raw.replace(/^=/, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

/**
 * A rule read back out of a file, or `undefined` for one this app has no equivalent for.
 *
 * Excel has ten or so validation types; this understands three and ignores the rest rather than
 * approximating them. An approximated rule refuses values the original allowed, in somebody
 * else's file, which is the worst way for an import to be wrong.
 */
export function fromExcelValidation(dv: ExcelValidation | undefined, readList: (formulae: unknown[]) => string[] | undefined): ValidationRule | undefined {
  if (!dv) return undefined;
  if (dv.type === "list") {
    const values = readList(dv.formulae ?? []);
    return values && values.length > 0 ? { kind: "list", values } : undefined;
  }
  if (dv.type === "decimal" || dv.type === "whole") {
    switch (dv.operator) {
      case "between": {
        const min = numberIn(dv.formulae, 0);
        const max = numberIn(dv.formulae, 1);
        return min === undefined && max === undefined ? undefined : { kind: "number", min, max };
      }
      case "greaterThanOrEqual":
      case "greaterThan": {
        const min = numberIn(dv.formulae, 0);
        return min === undefined ? undefined : { kind: "number", min };
      }
      case "lessThanOrEqual":
      case "lessThan": {
        const max = numberIn(dv.formulae, 0);
        return max === undefined ? undefined : { kind: "number", max };
      }
      default:
        return undefined;
    }
  }
  if (dv.type === "textLength" && (dv.operator === "lessThanOrEqual" || dv.operator === "lessThan")) {
    const max = numberIn(dv.formulae, 0);
    return max === undefined ? undefined : { kind: "length", max };
  }
  return undefined;
}
