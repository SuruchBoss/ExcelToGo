// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * The keyword matcher that answers when no Anthropic key is configured.
 *
 * On the public demo this is not a fallback — it is the only thing anyone ever sees, because the
 * demo refuses to spend the operator's budget and most visitors will not paste a key of their own.
 * So it is the feature the landing page leads with, and it was answering badly in two ways that a
 * blind run of the demo caught:
 *
 *   "รวมยอดขายทั้งหมด"                   → =SUM(E2)   — the sum of one cell
 *   "ต่อชื่อสินค้ากับหมวดหมู่เข้าด้วยกัน"  → =SUM(E2)   — a number, for a question about text
 *
 * The first is fixed in `aiRange.ts`: the caller now works out which cells the cursor means before
 * it asks. The second is fixed here, by refusing. Nothing in the old code could say "I don't know"
 * — every unmatched question fell through to SUM, which is the one wrong answer that looks right,
 * lands a plausible number in the cell, and tells nobody. The system prompt has forbidden the model
 * from doing exactly this since the last round; the matcher was still doing it.
 */
import { MESSAGES } from "@/i18n/messages";
import { Locale } from "@/i18n/types";

interface Rule {
  id: string;
  keywords: string[];
  build: (range: string) => string;
}

// Keywords match regardless of the UI's selected language, so a Thai speaker who types an
// English word (or vice versa) still gets a match — only the returned explanation is localized.
//
// Order matters: the first rule whose keyword appears wins, so the narrow phrasings come before
// the words that contain them. "นับจำนวนข้อความ" has to be tried before "นับ", and every text rule
// before "รวม", or "รวมข้อความ" is read as a request to add numbers up.
const RULES: Rule[] = [
  { id: "counta", keywords: ["นับจำนวนข้อความ", "counta", "นับที่ไม่ว่าง"], build: (r) => `COUNTA(${r})` },
  {
    id: "concatenate",
    // "ต่อชื่อสินค้ากับหมวดหมู่เข้าด้วยกัน" matched none of the old keywords and fell through to
    // SUM. These are the ways people actually ask for it.
    keywords: [
      "ต่อข้อความ", "รวมข้อความ", "ต่อคำ", "เชื่อมข้อความ", "เชื่อมคำ", "เข้าด้วยกัน",
      "ต่อกัน", "concatenate", "concat", "join", "combine text",
    ],
    build: () => `CONCATENATE(A1," ",B1)`,
  },
  { id: "average", keywords: ["เฉลี่ย", "average", "avg", "ค่าเฉลี่ย", "mean"], build: (r) => `AVERAGE(${r})` },
  { id: "max", keywords: ["มากที่สุด", "สูงสุด", "max", "highest", "largest"], build: (r) => `MAX(${r})` },
  { id: "min", keywords: ["น้อยที่สุด", "ต่ำสุด", "min", "lowest", "smallest"], build: (r) => `MIN(${r})` },
  { id: "count", keywords: ["นับ", "count", "จำนวน"], build: (r) => `COUNT(${r})` },
  { id: "vlookup", keywords: ["ค้นหา", "vlookup", "lookup", "ดึงข้อมูลจาก"], build: (r) => `VLOOKUP(A1,${r},2,FALSE)` },
  { id: "if", keywords: ["เงื่อนไข", "ถ้า", "if"], build: () => `IF(A1>0,"ผ่าน","ไม่ผ่าน")` },
  { id: "upper", keywords: ["ตัวพิมพ์ใหญ่", "upper"], build: () => `UPPER(A1)` },
  { id: "today", keywords: ["วันที่ปัจจุบัน", "today", "วันนี้"], build: () => `TODAY()` },
  { id: "sum", keywords: ["รวม", "บวก", "sum", "total", "ยอดรวม"], build: (r) => `SUM(${r})` },
];

export interface HeuristicResult {
  /** `null` when no rule matched — the panel then offers no formula rather than a wrong one. */
  formula: string | null;
  explanation: string;
}

export function heuristicSuggest(question: string, range: string | undefined, locale: Locale): HeuristicResult {
  const t = MESSAGES[locale].aiHeuristic;
  const q = question.toLowerCase();
  // A range the caller could not widen is still better than a guess at A1:A10, which is a claim
  // about a sheet this function has never seen.
  const targetRange = range?.trim() || "A1:A10";
  for (const rule of RULES) {
    if (rule.keywords.some((k) => q.includes(k.toLowerCase()))) {
      return { formula: `=${rule.build(targetRange)}`, explanation: t.rules[rule.id] };
    }
  }
  return { formula: null, explanation: t.noMatch };
}
