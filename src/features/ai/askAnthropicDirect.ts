"use client";

/**
 * Asks Anthropic from the browser, with the visitor's own key.
 *
 * The SDK is loaded with a dynamic import so it stays out of the initial bundle — nobody who never
 * opens the AI panel pays for it, which matters because this app's whole pitch is that it loads and
 * runs on your machine.
 */
import { heuristicSuggest } from "@/lib/aiHeuristic";
import { AI_MAX_TOKENS, AI_MODEL, SYSTEM_PROMPTS, buildUserMessage, parseFormulaReply } from "@/lib/aiPrompt";
import { Locale } from "@/i18n/types";

export interface AskResult {
  formula: string;
  explanation: string;
  source: "ai" | "heuristic";
}

export async function askAnthropicDirect(
  apiKey: string,
  question: string,
  selection: string | undefined,
  locale: Locale
): Promise<AskResult> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  // `dangerouslyAllowBrowser` is the point rather than a workaround: the key belongs to the person
  // typing it, and this keeps it from travelling through anybody else's server. The SDK sends the
  // `anthropic-dangerous-direct-browser-access` header that Anthropic's CORS policy requires.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS,
    system: SYSTEM_PROMPTS[locale],
    messages: [{ role: "user", content: buildUserMessage(question, selection) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  try {
    return { ...parseFormulaReply(text), source: "ai" };
  } catch {
    // A reply that doesn't parse is still an answered, billed request — falling back locally beats
    // showing the person who just paid for it an error.
    return { ...heuristicSuggest(question, selection, locale), source: "heuristic" };
  }
}
