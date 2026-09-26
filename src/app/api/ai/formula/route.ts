// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import Anthropic from "@anthropic-ai/sdk";
import { heuristicSuggest } from "@/lib/aiHeuristic";
import { AI_MAX_TOKENS, AI_MODEL, SYSTEM_PROMPTS, buildUserMessage, parseFormulaReply, parseLocale } from "@/lib/aiPrompt";
import { clientKey, createRateLimiter } from "@/lib/server/rateLimiter";
import { DEMO_MODE } from "@/lib/demoMode";

export const runtime = "nodejs";

/**
 * This route takes no token — the assistant is part of the app and making a visitor authenticate
 * to use it would be absurd — so a ceiling is the only thing standing between a script in a loop
 * and the operator's Anthropic bill. Twenty a minute is far more than a person clicking "ask AI"
 * will ever need and far less than a loop wants.
 *
 * Module scope, so the counters live as long as the server process. See rateLimiter.ts for what
 * that does and does not buy on a multi-instance or serverless deployment.
 */
const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

interface RequestBody {
  question?: string;
  selection?: string;
  headers?: string[];
  locale?: string;
}

export async function POST(request: Request) {
  // Before parsing the body: a refusal shouldn't cost the work of reading the request it refuses.
  const verdict = limiter.check(clientKey(request.headers));
  if (!verdict.allowed) {
    return Response.json(
      { error: "rate_limited", retryAfterSec: verdict.retryAfterSec },
      { status: 429, headers: { "retry-after": String(verdict.retryAfterSec) } }
    );
  }

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

  // A public demo must not be able to spend the operator's Anthropic budget. This route takes no
  // token, so a key configured on the host is billable by anyone who finds the URL, and the
  // per-process rate limit is a speed bump, not a ceiling. The panel keeps working either way —
  // `heuristicSuggest` runs locally and costs nothing — so the demo gives up the model's judgement,
  // not the feature. Structural, so it holds even if someone sets the key on the demo by mistake.
  const apiKey = DEMO_MODE ? undefined : process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ ...heuristicSuggest(question, selection, locale), source: "heuristic" });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      system: SYSTEM_PROMPTS[locale],
      messages: [{ role: "user", content: buildUserMessage(question, selection, headers) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";
    return Response.json({ ...parseFormulaReply(text), source: "ai" });
  } catch (err) {
    console.error("AI formula suggestion failed, falling back to heuristic", err);
    return Response.json({ ...heuristicSuggest(question, selection, locale), source: "heuristic" });
  }
}
