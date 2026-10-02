// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * The keyword matcher that answers when no Anthropic key is configured.
 *
 * On a deployment without a key this is not a fallback — it is the only thing anyone ever sees, so
 * it is the feature the landing page leads with. Its rule is the README's: a question it cannot
 * answer is a better outcome than an answer it cannot justify. When it is not sure it says so and
 * points at the form in the formula palette that is (`form`), rather than handing over a formula
 * that looks right in a green card.
 *
 * QA's second round (#62, #63) found it confidently wrong in three ways, each fixed here:
 *
 * - **Words inside words.** "count" matched "account", "if" matched "difference", "min" matched
 *   "minus". Latin keywords now match whole words; Thai, written without spaces, still matches
 *   inside a phrase.
 * - **The first rule won.** "จำนวนเงินรวมทั้งหมด" (the total amount of money) hit COUNT on "จำนวน"
 *   before SUM on "รวม" and answered 9 instead of 7,495. Intents now have a precedence, and
 *   "จำนวนเงิน" is an amount.
 * - **Conditions were dropped.** "ยอดรวมของหมวดเครื่องดื่ม" (the total for drinks) came back as the
 *   total of everything. A question with a qualifier, or one that names a value from the sheet,
 *   now goes to SUMIF/COUNTIF/AVERAGEIF's form instead; an IF or a lookup is only built when the
 *   question says what to compare or find, and per-row formulas are built on the cursor's row from
 *   the columns the question names, not on the header row.
 */
import { MESSAGES } from "@/i18n/messages";
import { Locale } from "@/i18n/types";
import type { NamedColumn } from "./aiRange";

/** What the caller knows about the sheet. The matcher runs on the server too, where there is no
 *  sheet, so everything it needs to know arrives here. */
export interface AskContext {
  /** The cells the cursor means (`aiRange.ts`), never the cell the answer goes into. */
  range?: string;
  /** The range holds text, so a count is COUNTA. */
  rangeIsText?: boolean;
  /** The cursor's row, 1-based, for formulas that work along one row. */
  row?: number;
  /** Row 1's column names and the data under each. */
  columns?: NamedColumn[];
  /** Values from the sheet the question names ("Drinks", "เครื่องดื่ม") — a condition. */
  mentions?: string[];
}

export interface HeuristicResult {
  /** `null` when it will not guess — the panel then offers no formula rather than a wrong one. */
  formula: string | null;
  explanation: string;
  /** A formula palette id whose form fits the question, offered when `formula` is null. */
  form?: string;
}

type Aggregate = "sum" | "average" | "max" | "min" | "count" | "counta";

const KEYWORDS = {
  today: ["วันที่ปัจจุบัน", "วันนี้", "today"],
  concatenate: ["ต่อข้อความ", "รวมข้อความ", "ต่อคำ", "เชื่อมข้อความ", "เชื่อมคำ", "เข้าด้วยกัน", "ต่อกัน", "concatenate", "concat", "join", "combine"],
  upper: ["ตัวพิมพ์ใหญ่", "upper", "uppercase", "capitals", "capital letters"],
  lookup: ["ค้นหา", "vlookup", "xlookup", "lookup", "look up", "ดึงข้อมูลจาก"],
  subtract: ["ลบ", "ผลต่าง", "ต่างกัน", "minus", "subtract", "difference"],
  dates: ["วัน", "day", "days", "date", "dates"],
  ifs: ["ถ้า", "หาก", "เงื่อนไข", "if"],
  counta: ["นับจำนวนข้อความ", "นับที่ไม่ว่าง", "counta"],
  count: ["นับ", "count", "how many", "กี่"],
  average: ["เฉลี่ย", "average", "avg", "mean"],
  max: ["มากที่สุด", "สูงสุด", "max", "maximum", "highest", "largest", "biggest"],
  min: ["น้อยที่สุด", "ต่ำสุด", "min", "minimum", "lowest", "smallest"],
  sum: ["รวม", "บวก", "sum", "total", "add up"],
  // "จำนวน" is "number of" and also "amount"; it is a count only when nothing says total.
  quantity: ["จำนวน"],
  thisColumn: ["คอลัมน์นี้", "this column"],
};

/** Words that make a question about some rows only (#63). Checked on aggregates, not on an IF,
 *  which is a comparison by nature. */
const QUALIFIERS = [
  "เฉพาะ", "ของหมวด", "แยกตาม", "มากกว่า", "น้อยกว่า", "ไม่เกิน", "ไม่ถึง", "อย่างน้อย", "เกิน", "ต่ำกว่า", "สูงกว่า",
  "เท่ากับ", "ที่เป็น", "where", "only", "greater than", "more than", "less than", "fewer than", "above", "below",
  "over", "under", "at least", "at most", "per", "grouped", "by category", "excluding", "except",
];
/** "for" is a qualifier ("for Bakery") unless it means everything ("for every sale"). */
const FOR_EVERYTHING = /\bfor\s+(this|all|every|each|everything|the whole|the entire)\b/;

const isLatin = (keyword: string) => /[a-z]/i.test(keyword);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A Latin keyword as a whole word; a Thai one anywhere, because Thai has no spaces between words. */
function mentions(q: string, keyword: string): boolean {
  if (!isLatin(keyword)) return q.includes(keyword);
  return new RegExp(`(^|[^a-z0-9])${escape(keyword)}([^a-z0-9]|$)`, "i").test(q);
}
const any = (q: string, keywords: readonly string[]) => keywords.some((k) => mentions(q, k));

function aggregateOf(q: string): Aggregate | null {
  if (any(q, KEYWORDS.average)) return "average";
  if (any(q, KEYWORDS.max)) return "max";
  if (any(q, KEYWORDS.min)) return "min";
  if (any(q, KEYWORDS.counta)) return "counta";
  if (any(q, KEYWORDS.count)) return "count";
  if (any(q, KEYWORDS.sum)) return "sum";
  if (any(q, KEYWORDS.quantity)) return "count";
  return null;
}

function hasQualifier(q: string): boolean {
  if (any(q, QUALIFIERS)) return true;
  return /\bfor\b/.test(q) && !FOR_EVERYTHING.test(q);
}

/** Every keyword the matcher knows, so a column named "Total" or "จำนวน" is not read as a column
 *  when it is really the question's verb. */
const ALL_KEYWORDS = new Set(Object.values(KEYWORDS).flat().map((k) => k.toLowerCase()));

/** The columns the question names, in the order it names them. */
function namedIn(q: string, columns: readonly NamedColumn[]): NamedColumn[] {
  return columns
    .filter((c) => c.name.length >= 2 && !ALL_KEYWORDS.has(c.name.toLowerCase()))
    .map((c) => ({ c, at: q.indexOf(c.name.toLowerCase()) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.c);
}

const FORM_FOR: Record<Aggregate, string> = { sum: "SUM", average: "AVERAGE", max: "MAX", min: "MIN", count: "COUNT", counta: "COUNTA" };
const CONDITIONAL_FORM: Partial<Record<Aggregate, string>> = { sum: "SUMIF", average: "AVERAGEIF", count: "COUNTIF", counta: "COUNTIF" };
const FN: Record<Aggregate, string> = { sum: "SUM", average: "AVERAGE", max: "MAX", min: "MIN", count: "COUNT", counta: "COUNTA" };

/** The comparison an IF asks for, with its number — `null` when either is missing. */
function comparisonOf(q: string): { op: string; value: string } | null {
  const number = "\\s*(-?\\d+(?:\\.\\d+)?)";
  const phrases: [string, string[]][] = [
    [">=", ["ไม่น้อยกว่า", "อย่างน้อย", "ตั้งแต่", "at least", "no less than", "greater than or equal to"]],
    ["<=", ["ไม่เกิน", "ไม่มากกว่า", "at most", "no more than", "not more than", "less than or equal to"]],
    [">", ["มากกว่า", "เกิน", "สูงกว่า", "greater than", "more than", "above", "over", "higher than", "exceeds"]],
    ["<", ["น้อยกว่า", "ต่ำกว่า", "ไม่ถึง", "less than", "below", "under", "lower than", "fewer than"]],
    ["=", ["เท่ากับ", "equal to", "equals"]],
  ];
  for (const [op, words] of phrases) {
    for (const w of words) {
      const m = new RegExp(`${escape(w)}${number}`).exec(q);
      if (m) return { op, value: m[1] };
    }
  }
  return null;
}

/** What an IF shows: quoted words first, then "show X … otherwise Y" / "ให้ขึ้นว่า X … ไม่งั้น Y". */
function outcomesOf(question: string, fallback: readonly [string, string]): [string, string] {
  const quoted = [...question.matchAll(/["“”']([^"“”']{1,40})["“”']/g)].map((m) => m[1].trim());
  const shown =
    /(?:show|display|say)\s+([^\s,.]+)/i.exec(question)?.[1] ?? /(?:ให้ขึ้นว่า|ให้แสดงว่า|ให้แสดง|แสดงว่า|ให้ขึ้น)\s*([^\s,]+)/.exec(question)?.[1];
  const otherwise =
    /(?:otherwise|else)\s+(?:show\s+|display\s+)?([^\s,.]+)/i.exec(question)?.[1] ??
    /(?:ไม่งั้น|ไม่เช่นนั้น|นอกนั้น|ถ้าไม่)\s*(?:ให้ขึ้นว่า|ให้แสดง|ขึ้นว่า|แสดง)?\s*([^\s,]+)/.exec(question)?.[1];
  const yes = quoted[0] ?? shown?.replace(/["“”']/g, "") ?? fallback[0];
  const no = quoted[1] ?? otherwise?.replace(/["“”']/g, "") ?? fallback[1];
  return [yes, no];
}

export function heuristicSuggest(question: string, context: AskContext | string | undefined, locale: Locale): HeuristicResult {
  const t = MESSAGES[locale].aiHeuristic;
  const ctx: AskContext = typeof context === "string" ? { range: context } : (context ?? {});
  const q = question.toLowerCase();
  const columns = namedIn(q, ctx.columns ?? []);
  // The row a per-row formula works on: the cursor's, unless that is the header row.
  const row = ctx.row === undefined ? undefined : ctx.columns?.length && ctx.row === 1 ? 2 : ctx.row;
  const decline = (explanation: string, form?: string): HeuristicResult => ({ formula: null, explanation, form });
  const answer = (formula: string, rule: string): HeuristicResult => ({ formula: `=${formula}`, explanation: t.rules[rule] });

  if (any(q, KEYWORDS.today)) return answer("TODAY()", "today");

  if (any(q, KEYWORDS.concatenate)) {
    if (columns.length < 2 || row === undefined) return decline(t.declined.textColumns("CONCATENATE"), "CONCATENATE");
    return answer(`CONCATENATE(${columns[0].col}${row}," ",${columns[1].col}${row})`, "concatenate");
  }
  if (any(q, KEYWORDS.upper)) {
    if (columns.length < 1 || row === undefined) return decline(t.declined.textColumns("UPPER"), "UPPER");
    return answer(`UPPER(${columns[0].col}${row})`, "upper");
  }
  if (any(q, KEYWORDS.lookup)) return decline(t.declined.lookup, "VLOOKUP");
  if (any(q, KEYWORDS.subtract)) {
    return any(q, KEYWORDS.dates) ? decline(t.declined.dates, "DATEDIF") : decline(t.declined.subtract);
  }

  if (any(q, KEYWORDS.ifs)) {
    const comparison = comparisonOf(q);
    const [column] = columns;
    if (!comparison || !column || row === undefined) return decline(t.declined.ifDetail, "IF");
    const [yes, no] = outcomesOf(question, t.ifOutcomes);
    const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return answer(`IF(${column.col}${row}${comparison.op}${comparison.value},${quote(yes)},${quote(no)})`, "if");
  }

  // Before anything else is read: "จำนวนเงิน" is an amount of money, never "the number of".
  const aggregate = aggregateOf(q.replaceAll("จำนวนเงิน", " "));
  if (!aggregate) return decline(t.noMatch);

  if (hasQualifier(q) || (ctx.mentions?.length ?? 0) > 0) {
    const form = CONDITIONAL_FORM[aggregate];
    return decline(t.declined.conditional(form ?? null), form);
  }

  // Which cells: "this column" means the cursor's; a single column the question names means that
  // column; otherwise the cursor's again.
  const counting = aggregate === "count" || aggregate === "counta";
  const usable = columns.filter((c) => counting || c.numeric);
  let range = ctx.range;
  let isText = ctx.rangeIsText ?? false;
  if (!any(q, KEYWORDS.thisColumn) && usable.length === 1) {
    range = usable[0].range;
    isText = !usable[0].numeric;
  }
  if (!range) return decline(t.declined.needsRange(FORM_FOR[aggregate]), FORM_FOR[aggregate]);

  const fn = aggregate === "count" && isText ? "counta" : aggregate;
  return answer(`${FN[fn]}(${range})`, fn);
}
