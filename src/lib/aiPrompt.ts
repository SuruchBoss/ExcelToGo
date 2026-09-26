// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * The prompt and the reply parsing, in one place because two callers now need them: the server
 * route (`/api/ai/formula`, used when the operator has configured a key) and the browser, when a
 * visitor has supplied a key of their own and the request goes straight to Anthropic without
 * passing through this app at all.
 *
 * Keeping them here is what makes "the same question gives the same answer either way" a property
 * of the code rather than a thing someone has to remember when editing one of the two.
 */
import { DEFAULT_LOCALE, Locale } from "@/i18n/types";
import { FUNCTIONS } from "./formulaEngine/functions";

/**
 * The functions this app can actually evaluate, read from the engine itself.
 *
 * Asked with a real key, the model answered fourteen ordinary questions with six formulas this
 * engine cannot run — TEXTJOIN, CHAR, FIND, RANK.EQ, SUMPRODUCT, CEILING. Every one is valid Excel
 * and every one lands in the cell as `#NAME?`, after the user has clicked a button labelled
 * "insert". The model was never told what exists here; a spreadsheet assistant that suggests
 * Excel's whole function set is only right by luck.
 *
 * Generated from `FUNCTIONS` rather than typed out, for the same reason the test counts are: a
 * hand-written list is a second copy, and the copy that goes stale is the one telling the model
 * what it may use.
 */
const SUPPORTED_FUNCTIONS = Object.keys(FUNCTIONS).sort().join(", ");

export const AI_MODEL = "claude-opus-5";
/**
 * 400 was enough until the prompt started asking for a warning when a formula uses a function this
 * engine lacks — those explanations run longer, and a reply cut off mid-object has no closing brace
 * for `parseFormulaReply` to find. Measured: "how many unique branch names are there" came back at
 * `stop_reason: "max_tokens"`, exactly 400 tokens, JSON unterminated, and the route fell back to the
 * local matcher without anything telling the user their question had reached the model at all.
 *
 * Output tokens are the expensive half, but the difference here is a fraction of a cent per ask and
 * the failure it prevents is silent.
 */
export const AI_MAX_TOKENS = 800;

export const SYSTEM_PROMPTS: Record<Locale, string> = {
  th: `คุณคือผู้ช่วยแนะนำสูตร Excel ให้กับผู้ใช้ทั่วไปที่อาจไม่ถนัดสูตร
รับคำอธิบายสิ่งที่ผู้ใช้ต้องการ (ภาษาไทยหรืออังกฤษ) พร้อมช่วงเซลล์ที่เลือกไว้ (ถ้ามี) และหัวคอลัมน์ (ถ้ามี)
แล้วตอบกลับเป็น JSON เท่านั้น รูปแบบ:
{"formula": "=SUM(A1:A10)", "explanation": "คำอธิบายสั้นๆ เป็นภาษาไทยว่าสูตรนี้ทำอะไร (ไม่เกิน 2 ประโยค)"}
กฎ:
- "formula" ต้องขึ้นต้นด้วย "=" และเป็นสูตร Excel ที่ถูกต้องตามไวยากรณ์มาตรฐาน
- ถ้ามีช่วงเซลล์ที่เลือกไว้ ให้ใช้ช่วงนั้นในสูตรถ้าเหมาะสม
- "explanation" ต้องเป็นภาษาไทยเสมอ
- ห้ามใส่ข้อความอื่นนอกเหนือจาก JSON object เดียวนี้
- แอปนี้มีเอนจินคำนวณของตัวเอง **คำนวณได้เฉพาะฟังก์ชันเหล่านี้** ฟังก์ชันอื่นจะขึ้น #NAME? ในเซลล์:
${SUPPORTED_FUNCTIONS}
- ถ้าทำได้ด้วยฟังก์ชันในรายการ ให้ใช้รายการนี้
- ถ้าโจทย์ต้องใช้ฟังก์ชันนอกรายการจริง ๆ **ให้ตอบสูตร Excel ที่ถูกต้องตามปกติ** แล้วขึ้นต้น explanation
  ด้วยคำเตือนว่าแอปนี้คำนวณสูตรนี้ไม่ได้ (จะขึ้น #NAME?) แต่ใช้ได้เมื่อส่งออกเป็นไฟล์ Excel
- **ห้ามเปลี่ยนไปใช้ฟังก์ชันอื่นที่ไม่ตรงโจทย์เพียงเพื่อให้อยู่ในรายการ** เช่น ถูกถามให้ต่อข้อความแล้วตอบ SUM
  สูตรผิดที่ดูเหมือนถูกนั้นแย่กว่าสูตรที่แอปรันไม่ได้ เพราะผู้ใช้จะไม่รู้เลยว่าได้คำตอบผิด`,
  en: `You are an assistant that suggests Excel formulas for everyday users who may not know formula syntax.
You'll receive a description of what the user wants (in Thai or English), the cell range they have selected (if any), and column headers (if any).
Reply with JSON only, in this shape:
{"formula": "=SUM(A1:A10)", "explanation": "A short explanation in English of what this formula does — two sentences at most"}
Rules:
- "formula" must start with "=" and be valid standard Excel formula syntax.
- If a cell range is selected, use it in the formula when appropriate.
- "explanation" must always be in English.
- Do not include any text other than this one JSON object.
- This app has its own formula engine. It can evaluate **only these functions**; anything else lands
  in the cell as #NAME?:
${SUPPORTED_FUNCTIONS}
- If the task can be done with functions on that list, use them.
- If it genuinely requires a function that is not listed, **still give the correct Excel formula**,
  and begin the explanation with a warning that this app cannot calculate it (it will show #NAME?)
  although it will work once the file is exported to Excel.
- **Never substitute an unrelated function just to stay on the list** — answering "join these names"
  with SUM, for instance. A wrong formula that looks right is worse than one the app cannot run,
  because nothing tells the user the answer is wrong.`,
};

export function parseLocale(value: unknown): Locale {
  return value === "en" ? "en" : DEFAULT_LOCALE;
}

export function buildUserMessage(question: string, selection?: string, headers: string[] = []): string {
  return [
    `User's request: ${question}`,
    selection ? `Selected cell range: ${selection}` : null,
    headers.length ? `Column headers: ${headers.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface FormulaSuggestion {
  formula: string;
  explanation: string;
}

/**
 * Pulls the JSON object out of the model's reply.
 *
 * Throws rather than returning a partial result: both callers fall back to the local keyword
 * matcher, and a formula that doesn't start with "=" would be pasted straight into a cell as text,
 * which looks like the app is broken rather than like the model had an off moment.
 */
export function parseFormulaReply(text: string): FormulaSuggestion {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    const parsed = JSON.parse(match[0]) as { formula?: string; explanation?: string };
    if (!parsed.formula || !parsed.formula.startsWith("=")) throw new Error("invalid_formula");
    return { formula: parsed.formula, explanation: parsed.explanation ?? "" };
  }

  // No closing brace. Almost always a reply cut off at `max_tokens` mid-explanation — and the
  // formula is the first field in the shape we ask for, so it is already complete and intact.
  // Throwing here would drop a good formula and quietly serve the local matcher instead; the
  // explanation is the part worth losing.
  const salvaged = text.match(/"formula"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!salvaged) throw new Error("no_json_in_response");
  const formula = JSON.parse(`"${salvaged[1]}"`) as string;
  if (!formula.startsWith("=")) throw new Error("invalid_formula");
  return { formula, explanation: "" };
}
