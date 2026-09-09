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
    build: (v) => `SUMIF(${v.range},${quoteIfNeeded(v.criteria)},${v.sumRange})`,
  },
  {
    id: "COUNTIF",
    categoryKey: "stats",
    syntax: "COUNTIF(range, criteria)",
    params: [req("range", "range"), req("criteria", "text")],
    build: (v) => `COUNTIF(${v.range},${quoteIfNeeded(v.criteria)})`,
  },
  {
    id: "AVERAGEIF",
    categoryKey: "stats",
    syntax: "AVERAGEIF(range, criteria, average_range)",
    params: [req("range", "range"), req("criteria", "text"), req("avgRange", "range")],
    build: (v) => `AVERAGEIF(${v.range},${quoteIfNeeded(v.criteria)},${v.avgRange})`,
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
