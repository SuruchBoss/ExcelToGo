// Keyword-based fallback used when no ANTHROPIC_API_KEY is configured, so the
// AI assistant panel still returns something useful out of the box.
import { MESSAGES } from "@/i18n/messages";
import { Locale } from "@/i18n/types";

interface Rule {
  id: string;
  keywords: string[];
  build: (range: string) => string;
}

// Keywords match regardless of the UI's selected language, so a Thai speaker who types an
// English word (or vice versa) still gets a match — only the returned explanation is localized.
const RULES: Rule[] = [
  { id: "sum", keywords: ["รวม", "บวก", "sum", "total", "ยอดรวม"], build: (r) => `SUM(${r})` },
  { id: "average", keywords: ["เฉลี่ย", "average", "avg", "ค่าเฉลี่ย"], build: (r) => `AVERAGE(${r})` },
  { id: "max", keywords: ["มากที่สุด", "สูงสุด", "max", "highest"], build: (r) => `MAX(${r})` },
  { id: "min", keywords: ["น้อยที่สุด", "ต่ำสุด", "min", "lowest"], build: (r) => `MIN(${r})` },
  { id: "counta", keywords: ["นับจำนวนข้อความ", "counta", "นับที่ไม่ว่าง"], build: (r) => `COUNTA(${r})` },
  { id: "count", keywords: ["นับ", "count", "จำนวน"], build: (r) => `COUNT(${r})` },
  { id: "vlookup", keywords: ["ค้นหา", "vlookup", "lookup"], build: (r) => `VLOOKUP(A1,${r},2,FALSE)` },
  { id: "if", keywords: ["เงื่อนไข", "ถ้า", "if"], build: () => `IF(A1>0,"ผ่าน","ไม่ผ่าน")` },
  { id: "concatenate", keywords: ["ต่อข้อความ", "รวมข้อความ", "concatenate", "concat"], build: () => `CONCATENATE(A1," ",B1)` },
  { id: "upper", keywords: ["ตัวพิมพ์ใหญ่", "upper"], build: () => `UPPER(A1)` },
  { id: "today", keywords: ["วันที่ปัจจุบัน", "today", "วันนี้"], build: () => `TODAY()` },
];

export function heuristicSuggest(question: string, range: string | undefined, locale: Locale): { formula: string; explanation: string } {
  const t = MESSAGES[locale].aiHeuristic;
  const q = question.toLowerCase();
  const targetRange = range && /:/.test(range) ? range : range || "A1:A10";
  for (const rule of RULES) {
    if (rule.keywords.some((k) => q.includes(k.toLowerCase()))) {
      return { formula: `=${rule.build(targetRange)}`, explanation: t.rules[rule.id] };
    }
  }
  return {
    formula: `=SUM(${targetRange})`,
    explanation: t.fallback,
  };
}
