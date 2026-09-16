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

export const AI_MODEL = "claude-opus-5";
export const AI_MAX_TOKENS = 400;

export const SYSTEM_PROMPTS: Record<Locale, string> = {
  th: `คุณคือผู้ช่วยแนะนำสูตร Excel ให้กับผู้ใช้ทั่วไปที่อาจไม่ถนัดสูตร
รับคำอธิบายสิ่งที่ผู้ใช้ต้องการ (ภาษาไทยหรืออังกฤษ) พร้อมช่วงเซลล์ที่เลือกไว้ (ถ้ามี) และหัวคอลัมน์ (ถ้ามี)
แล้วตอบกลับเป็น JSON เท่านั้น รูปแบบ:
{"formula": "=SUM(A1:A10)", "explanation": "คำอธิบายสั้นๆ เป็นภาษาไทยว่าสูตรนี้ทำอะไร"}
กฎ:
- "formula" ต้องขึ้นต้นด้วย "=" และเป็นสูตร Excel ที่ถูกต้องตามไวยากรณ์มาตรฐาน
- ถ้ามีช่วงเซลล์ที่เลือกไว้ ให้ใช้ช่วงนั้นในสูตรถ้าเหมาะสม
- "explanation" ต้องเป็นภาษาไทยเสมอ
- ห้ามใส่ข้อความอื่นนอกเหนือจาก JSON object เดียวนี้`,
  en: `You are an assistant that suggests Excel formulas for everyday users who may not know formula syntax.
You'll receive a description of what the user wants (in Thai or English), the cell range they have selected (if any), and column headers (if any).
Reply with JSON only, in this shape:
{"formula": "=SUM(A1:A10)", "explanation": "A short explanation in English of what this formula does"}
Rules:
- "formula" must start with "=" and be valid standard Excel formula syntax.
- If a cell range is selected, use it in the formula when appropriate.
- "explanation" must always be in English.
- Do not include any text other than this one JSON object.`,
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
  if (!match) throw new Error("no_json_in_response");
  const parsed = JSON.parse(match[0]) as { formula?: string; explanation?: string };
  if (!parsed.formula || !parsed.formula.startsWith("=")) throw new Error("invalid_formula");
  return { formula: parsed.formula, explanation: parsed.explanation ?? "" };
}
