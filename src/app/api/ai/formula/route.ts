import Anthropic from "@anthropic-ai/sdk";
import { heuristicSuggest } from "@/lib/aiHeuristic";
import { DEFAULT_LOCALE, Locale } from "@/i18n/types";

export const runtime = "nodejs";

interface RequestBody {
  question?: string;
  selection?: string;
  headers?: string[];
  locale?: string;
}

const SYSTEM_PROMPTS: Record<Locale, string> = {
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

function parseLocale(value: unknown): Locale {
  return value === "en" ? "en" : DEFAULT_LOCALE;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const question = (body.question ?? "").toString().slice(0, 1000).trim();
  if (!question) {
    return Response.json({ error: "missing_question" }, { status: 400 });
  }
  const selection = body.selection ? String(body.selection).slice(0, 100) : undefined;
  const headers = Array.isArray(body.headers) ? body.headers.slice(0, 50).map((h) => String(h).slice(0, 60)) : [];
  const locale = parseLocale(body.locale);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ ...heuristicSuggest(question, selection, locale), source: "heuristic" });
  }

  try {
    const client = new Anthropic({ apiKey });
    const userMessage = [
      `User's request: ${question}`,
      selection ? `Selected cell range: ${selection}` : null,
      headers.length ? `Column headers: ${headers.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system: SYSTEM_PROMPTS[locale],
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no_json_in_response");
    const parsed = JSON.parse(match[0]) as { formula?: string; explanation?: string };
    if (!parsed.formula || !parsed.formula.startsWith("=")) throw new Error("invalid_formula");

    return Response.json({
      formula: parsed.formula,
      explanation: parsed.explanation ?? "",
      source: "ai",
    });
  } catch (err) {
    console.error("AI formula suggestion failed, falling back to heuristic", err);
    return Response.json({ ...heuristicSuggest(question, selection, locale), source: "heuristic" });
  }
}
