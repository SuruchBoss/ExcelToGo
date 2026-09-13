import { CategoryKey, Messages } from "@/i18n/types";

export type ParamType = "range" | "cell" | "number" | "text" | "boolean";

/** Structural, locale-independent shape of a formula's parameter — its display label,
 *  placeholder, and option labels (for a <select> param like VLOOKUP's exact/approximate
 *  toggle) live in the locale messages (`src/i18n/th.ts` / `en.ts`) under `formulas.<id>`. */
interface ParamSpec {
  key: string;
  type: ParamType;
  optional?: boolean;
  defaultValue?: string;
  /** For a param rendered as a <select>: the fixed values it can take (labels are translated). */
  optionValues?: string[];
}

interface FormulaSpec {
  id: string;
  categoryKey: CategoryKey;
  syntax: string;
  params: ParamSpec[];
  build: (values: Record<string, string>) => string;
}

export interface FormulaParam {
  key: string;
  label: string;
  type: ParamType;
  placeholder?: string;
  optional?: boolean;
  defaultValue?: string;
  options?: { value: string; label: string }[];
}

/** The localized, consumer-facing shape components render — merges a FormulaSpec's structure
 *  with the current locale's text from `Messages.formulas[id]`. */
export interface FormulaDef {
  id: string;
  name: string;
  category: string;
  categoryKey: CategoryKey;
  syntax: string;
  description: string;
  example: string;
  params: FormulaParam[];
  build: (values: Record<string, string>) => string;
}

export const CATEGORY_KEYS: CategoryKey[] = ["math", "stats", "logic", "text", "date", "lookup"];

function req(key: string, type: ParamType): ParamSpec {
  return { key, type };
}
function opt(key: string, type: ParamType, defaultValue = ""): ParamSpec {
  return { key, type, optional: true, defaultValue };
}

const FORMULA_SPECS: FormulaSpec[] = [
  {
    id: "SUM",
    categoryKey: "math",
    syntax: "SUM(range)",
    params: [req("range", "range")],
    build: (v) => `SUM(${v.range})`,
  },
  {
    id: "AVERAGE",
    categoryKey: "stats",
    syntax: "AVERAGE(range)",
    params: [req("range", "range")],
    build: (v) => `AVERAGE(${v.range})`,
  },
  {
    id: "COUNT",
    categoryKey: "stats",
    syntax: "COUNT(range)",
    params: [req("range", "range")],
    build: (v) => `COUNT(${v.range})`,
  },
  {
    id: "COUNTA",
    categoryKey: "stats",
    syntax: "COUNTA(range)",
    params: [req("range", "range")],
    build: (v) => `COUNTA(${v.range})`,
  },
  {
    id: "MIN",
    categoryKey: "stats",
    syntax: "MIN(range)",
    params: [req("range", "range")],
    build: (v) => `MIN(${v.range})`,
  },
  {
    id: "MAX",
    categoryKey: "stats",
    syntax: "MAX(range)",
    params: [req("range", "range")],
    build: (v) => `MAX(${v.range})`,
  },
  {
    id: "PRODUCT",
    categoryKey: "math",
    syntax: "PRODUCT(range)",
    params: [req("range", "range")],
    build: (v) => `PRODUCT(${v.range})`,
  },
  {
    id: "ROUND",
    categoryKey: "math",
    syntax: "ROUND(number, digits)",
    params: [req("number", "cell"), opt("digits", "number", "0")],
    build: (v) => `ROUND(${v.number},${v.digits || "0"})`,
  },
  {
    id: "ABS",
    categoryKey: "math",
    syntax: "ABS(number)",
    params: [req("number", "cell")],
    build: (v) => `ABS(${v.number})`,
  },
  {
    id: "SUMIF",
    categoryKey: "math",
    syntax: "SUMIF(range, criteria, sum_range)",
    params: [req("range", "range"), req("criteria", "text"), req("sumRange", "range")],
    build: (v) => `SUMIF(${v.range},${quoteCriteria(v.criteria)},${v.sumRange})`,
  },
  {
    id: "COUNTIF",
    categoryKey: "stats",
    syntax: "COUNTIF(range, criteria)",
    params: [req("range", "range"), req("criteria", "text")],
    build: (v) => `COUNTIF(${v.range},${quoteCriteria(v.criteria)})`,
  },
  {
    id: "AVERAGEIF",
    categoryKey: "stats",
    syntax: "AVERAGEIF(range, criteria, average_range)",
    params: [req("range", "range"), req("criteria", "text"), req("avgRange", "range")],
    build: (v) => `AVERAGEIF(${v.range},${quoteCriteria(v.criteria)},${v.avgRange})`,
  },
  {
    id: "SUMIFS",
    categoryKey: "math",
    syntax: "SUMIFS(sum_range, criteria_range1, criteria1, [criteria_range2, criteria2])",
    params: [
      req("sumRange", "range"),
      req("critRange1", "range"),
      req("criteria1", "text"),
      opt("critRange2", "range"),
      opt("criteria2", "text"),
    ],
    // The second condition is dropped entirely when either half is blank: a criteria range with
    // no criteria after it is a #VALUE!, not a formula the palette should be able to produce.
    build: (v) => {
      const second = v.critRange2?.trim() && v.criteria2?.trim() ? `,${v.critRange2},${quoteCriteria(v.criteria2)}` : "";
      return `SUMIFS(${v.sumRange},${v.critRange1},${quoteCriteria(v.criteria1)}${second})`;
    },
  },
  {
    id: "COUNTIFS",
    categoryKey: "stats",
    syntax: "COUNTIFS(criteria_range1, criteria1, [criteria_range2, criteria2])",
    params: [req("critRange1", "range"), req("criteria1", "text"), opt("critRange2", "range"), opt("criteria2", "text")],
    build: (v) => {
      const second = v.critRange2?.trim() && v.criteria2?.trim() ? `,${v.critRange2},${quoteCriteria(v.criteria2)}` : "";
      return `COUNTIFS(${v.critRange1},${quoteCriteria(v.criteria1)}${second})`;
    },
  },
  {
    id: "AVERAGEIFS",
    categoryKey: "stats",
    syntax: "AVERAGEIFS(average_range, criteria_range1, criteria1, [criteria_range2, criteria2])",
    params: [
      req("avgRange", "range"),
      req("critRange1", "range"),
      req("criteria1", "text"),
      opt("critRange2", "range"),
      opt("criteria2", "text"),
    ],
    build: (v) => {
      const second = v.critRange2?.trim() && v.criteria2?.trim() ? `,${v.critRange2},${quoteCriteria(v.criteria2)}` : "";
      return `AVERAGEIFS(${v.avgRange},${v.critRange1},${quoteCriteria(v.criteria1)}${second})`;
    },
  },
  {
    id: "MATCH",
    categoryKey: "lookup",
    syntax: "MATCH(lookup_value, range, [match_type])",
    params: [
      req("lookup", "cell"),
      req("range", "range"),
      { key: "matchType", type: "number", optional: true, defaultValue: "0", optionValues: ["0", "1", "-1"] },
    ],
    build: (v) => `MATCH(${v.lookup},${v.range},${v.matchType || "0"})`,
  },
  {
    id: "INDEX",
    categoryKey: "lookup",
    syntax: "INDEX(range, row_num, [col_num])",
    params: [req("range", "range"), req("rowNum", "number"), opt("colNum", "number")],
    build: (v) => `INDEX(${v.range},${v.rowNum}${v.colNum?.trim() ? `,${v.colNum}` : ""})`,
  },
  {
    id: "VLOOKUP",
    categoryKey: "lookup",
    syntax: "VLOOKUP(lookup_value, table, col_index, [exact])",
    params: [
      req("lookup", "cell"),
      req("table", "range"),
      req("colIndex", "number"),
      { key: "exact", type: "boolean", optional: true, defaultValue: "FALSE", optionValues: ["FALSE", "TRUE"] },
    ],
    build: (v) => `VLOOKUP(${v.lookup},${v.table},${v.colIndex},${v.exact || "FALSE"})`,
  },
  {
    id: "XLOOKUP",
    categoryKey: "lookup",
    syntax: "XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found])",
    params: [req("lookup", "cell"), req("lookupArray", "range"), req("returnArray", "range"), opt("ifNotFound", "text")],
    // The fallback is quoted like any other free-text value, and left out entirely when empty so
    // the formula falls back to #N/A rather than to a blank that looks like a found answer.
    build: (v) =>
      `XLOOKUP(${v.lookup},${v.lookupArray},${v.returnArray}${v.ifNotFound?.trim() ? `,${quoteIfNeeded(v.ifNotFound)}` : ""})`,
  },
  {
    id: "DATEDIF",
    categoryKey: "date",
    syntax: 'DATEDIF(start_date, end_date, "Y"|"M"|"D"|"MD"|"YM"|"YD")',
    params: [
      req("start", "cell"),
      req("end", "cell"),
      { key: "unit", type: "text", optional: false, defaultValue: "Y", optionValues: ["Y", "M", "D", "MD", "YM", "YD"] },
    ],
    build: (v) => `DATEDIF(${v.start},${v.end},"${v.unit || "Y"}")`,
  },
  {
    id: "IF",
    categoryKey: "logic",
    syntax: "IF(condition, value_if_true, value_if_false)",
    params: [req("cond", "text"), req("ifTrue", "text"), req("ifFalse", "text")],
    build: (v) => `IF(${v.cond},${quoteIfNeeded(v.ifTrue)},${quoteIfNeeded(v.ifFalse)})`,
  },
  {
    id: "IFERROR",
    categoryKey: "logic",
    syntax: "IFERROR(value, value_if_error)",
    params: [req("value", "text"), req("fallback", "text")],
    build: (v) => `IFERROR(${v.value},${quoteIfNeeded(v.fallback)})`,
  },
  {
    id: "AND",
    categoryKey: "logic",
    syntax: "AND(condition1, condition2, ...)",
    params: [req("cond1", "text"), opt("cond2", "text")],
    build: (v) => `AND(${[v.cond1, v.cond2].filter(Boolean).join(",")})`,
  },
  {
    id: "OR",
    categoryKey: "logic",
    syntax: "OR(condition1, condition2, ...)",
    params: [req("cond1", "text"), opt("cond2", "text")],
    build: (v) => `OR(${[v.cond1, v.cond2].filter(Boolean).join(",")})`,
  },
  {
    id: "CONCATENATE",
    categoryKey: "text",
    syntax: "CONCATENATE(text1, text2, ...)",
    params: [req("text1", "text"), req("text2", "text")],
    build: (v) => `CONCATENATE(${v.text1},${v.text2})`,
  },
  {
    id: "UPPER",
    categoryKey: "text",
    syntax: "UPPER(text)",
    params: [req("text", "cell")],
    build: (v) => `UPPER(${v.text})`,
  },
  {
    id: "LOWER",
    categoryKey: "text",
    syntax: "LOWER(text)",
    params: [req("text", "cell")],
    build: (v) => `LOWER(${v.text})`,
  },
  {
    id: "TRIM",
    categoryKey: "text",
    syntax: "TRIM(text)",
    params: [req("text", "cell")],
    build: (v) => `TRIM(${v.text})`,
  },
  {
    id: "LEFT",
    categoryKey: "text",
    syntax: "LEFT(text, num_chars)",
    params: [req("text", "cell"), req("n", "number")],
    build: (v) => `LEFT(${v.text},${v.n})`,
  },
  {
    id: "RIGHT",
    categoryKey: "text",
    syntax: "RIGHT(text, num_chars)",
    params: [req("text", "cell"), req("n", "number")],
    build: (v) => `RIGHT(${v.text},${v.n})`,
  },
  {
    id: "TODAY",
    categoryKey: "date",
    syntax: "TODAY()",
    params: [],
    build: () => `TODAY()`,
  },
  {
    id: "NOW",
    categoryKey: "date",
    syntax: "NOW()",
    params: [],
    build: () => `NOW()`,
  },
];

/**
 * Quotes a *criteria* value — the thing a SUMIF/SUMIFS-style function matches against.
 *
 * Two traps live here, both of which produced a broken formula from a perfectly reasonable entry:
 *
 * - A bare token shaped like a cell reference ("Q2", "A1", "B12") is a quarter, a grade or a
 *   product code far more often than it is a reference. Passing it through made the formula match
 *   an empty cell and quietly total zero.
 * - A comparison has to be quoted to be a criteria at all: `SUMIF(A1:A9,>100,B1:B9)` is not
 *   valid syntax, in this engine or in Excel. `">100"` is.
 *
 * A criteria that really should read from a cell is written Excel's own way, by concatenating —
 * `">"&F1`, or `""&F1` for the value alone — so anything containing `&` is left untouched.
 */
function quoteCriteria(text: string | undefined): string {
  const t = (text ?? "").trim();
  if (t === "") return '""';
  if (/^".*"$/.test(t)) return t;
  if (/^-?\d+(\.\d+)?$/.test(t)) return t;
  if (t.includes("&")) return t;
  return `"${t.replace(/"/g, '""')}"`;
}

function quoteIfNeeded(text: string | undefined): string {
  const t = (text ?? "").trim();
  if (t === "") return '""';
  // Already looks like a reference, number, string literal, or expression: leave as-is.
  if (/^".*"$/.test(t)) return t;
  if (/^-?\d+(\.\d+)?$/.test(t)) return t;
  if (/^\$?[A-Za-z]{1,3}\$?\d+(:\$?[A-Za-z]{1,3}\$?\d+)?$/.test(t)) return t;
  if (/[+\-*/&()<>=]/.test(t)) return t;
  return `"${t.replace(/"/g, '""')}"`;
}

function mergeFormula(spec: FormulaSpec, t: Messages): FormulaDef {
  const msg = t.formulas[spec.id];
  return {
    id: spec.id,
    name: msg.name,
    category: t.categories[spec.categoryKey],
    categoryKey: spec.categoryKey,
    syntax: spec.syntax,
    description: msg.description,
    example: msg.example,
    build: spec.build,
    params: spec.params.map((p) => ({
      key: p.key,
      type: p.type,
      optional: p.optional,
      defaultValue: p.defaultValue,
      label: msg.params[p.key]?.label ?? p.key,
      placeholder: msg.params[p.key]?.placeholder,
      options: p.optionValues?.map((value) => ({ value, label: msg.options?.[p.key]?.[value] ?? value })),
    })),
  };
}

/** The full formula catalog, localized text merged in for the given locale's messages. */
export function getFormulaCatalog(t: Messages): FormulaDef[] {
  return FORMULA_SPECS.map((spec) => mergeFormula(spec, t));
}

export function getFormulaById(t: Messages, id: string): FormulaDef | undefined {
  const spec = FORMULA_SPECS.find((s) => s.id === id);
  return spec ? mergeFormula(spec, t) : undefined;
}
