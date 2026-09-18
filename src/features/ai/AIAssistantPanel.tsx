"use client";

import { useState, useSyncExternalStore } from "react";
import { Sparkles, Loader2, KeyRound, ExternalLink } from "lucide-react";
import clsx from "clsx";
import { useAIContext, useSheetStore } from "@/store/sheetStore";
import { useLocale, useT } from "@/i18n";
import { clearKey, keyServerSnapshot, keySnapshot, looksLikeAnthropicKey, maskKey, saveKey, subscribeToKey } from "@/lib/byok";
import { askAnthropicDirect } from "./askAnthropicDirect";

interface Suggestion {
  /** `null` when the keyword matcher had no rule for the question — see aiHeuristic.ts. */
  formula: string | null;
  explanation: string;
  source: "ai" | "heuristic";
}

export default function AIAssistantPanel() {
  const t = useT();
  const locale = useLocale();
  const { address: selectionAddress, range, headers } = useAIContext();
  const onInsert = useSheetStore((s) => s.insertAIFormula);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  // `sessionStorage` does not exist during the server render, so the key arrives through a
  // subscription rather than an effect that sets state — see byok.ts.
  const savedKey = useSyncExternalStore(subscribeToKey, keySnapshot, keyServerSnapshot);
  const [keyDraft, setKeyDraft] = useState("");
  const [editingKey, setEditingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const commitKey = () => {
    const value = keyDraft.trim();
    if (!looksLikeAnthropicKey(value)) {
      setKeyError(t.ai.byok.invalid);
      return;
    }
    saveKey(value);
    setKeyDraft("");
    setEditingKey(false);
    setKeyError(null);
  };

  const forgetKey = () => {
    clearKey();
    setKeyDraft("");
    setEditingKey(false);
    setKeyError(null);
  };

  const ask = async (q: string) => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      // With the visitor's own key the request never touches this app's server — see byok.ts.
      // `range`, not `selectionAddress`: with a single cell highlighted those differ, and the
      // range is the one that makes "add up this column" mean a column. See aiRange.ts.
      if (savedKey) {
        setSuggestion(await askAnthropicDirect(savedKey, q, range, locale, headers));
        return;
      }
      const res = await fetch("/api/ai/formula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, selection: range, headers, locale }),
      });
      // "Too many, too fast" is a different situation from "the AI is unreachable", and the user
      // can act on it — so it says how long to wait instead of the generic connection error.
      if (res.status === 429) {
        const { retryAfterSec } = await res.json().catch(() => ({ retryAfterSec: 60 }));
        setError(t.ai.rateLimited(Number(retryAfterSec) || 60));
        return;
      }
      if (!res.ok) throw new Error("request_failed");
      const data = await res.json();
      setSuggestion(data);
    } catch {
      setError(t.ai.connectionError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <Sparkles size={16} className="text-emerald-600" /> {t.ai.title}
        </h2>
        <p className="text-xs text-zinc-500">{t.ai.subtitle}</p>
      </div>

      <div className="rounded-md bg-zinc-50 p-2 text-xs text-zinc-500">
        {t.ai.selectionLabel} <span className="font-medium text-zinc-700">{selectionAddress}</span>
      </div>

      {/* Bring your own key. Sits above the question box because it changes what the answer will
          be — finding it after a disappointing keyword guess is finding it too late. */}
      <div className="rounded-md border border-zinc-200 bg-white p-2.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
          <KeyRound size={13} className="text-emerald-600" /> {t.ai.byok.title}
        </p>

        {savedKey && !editingKey ? (
          <>
            <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-700">{t.ai.byok.active(maskKey(savedKey))}</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  setEditingKey(true);
                  setKeyDraft("");
                }}
                className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 hover:border-zinc-400"
              >
                {t.ai.byok.change}
              </button>
              <button onClick={forgetKey} className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 hover:border-zinc-400">
                {t.ai.byok.clear}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">{t.ai.byok.lead}</p>
            <div className="mt-2 flex gap-2">
              <label className="sr-only" htmlFor="byok-key">
                {t.ai.byok.title}
              </label>
              <input
                id="byok-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={keyDraft}
                onChange={(e) => {
                  setKeyDraft(e.target.value);
                  setKeyError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitKey();
                  }
                }}
                placeholder={t.ai.byok.placeholder}
                className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 font-mono text-[11px] outline-none focus:border-emerald-500"
              />
              <button
                onClick={commitKey}
                disabled={!keyDraft.trim()}
                className="shrink-0 rounded bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t.ai.byok.save}
              </button>
            </div>
            {keyError && <p className="mt-1.5 text-[11px] text-red-600">{keyError}</p>}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
            >
              {t.ai.byok.getKeyLink}
              <ExternalLink size={10} aria-hidden />
            </a>
          </>
        )}

        <p className="mt-2 border-t border-zinc-100 pt-2 text-[10px] leading-relaxed text-zinc-400">{t.ai.byok.privacyNote}</p>
      </div>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            ask(question);
          }
        }}
        placeholder={t.ai.textareaPlaceholder}
        rows={3}
        className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />

      <button
        onClick={() => ask(question)}
        disabled={loading || !question.trim()}
        className="flex items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        {t.ai.askButton}
      </button>

      <div className="flex flex-wrap gap-1.5">
        {t.ai.examples.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setQuestion(ex);
              ask(ex);
            }}
            className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600 hover:bg-zinc-200"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <p className="rounded bg-red-50 p-2 text-xs text-red-600">{error}</p>}

      {/* A declined answer is not an answer in a quieter colour — it is amber, it carries no
          formula, and it offers no Insert button, because there is nothing to insert. The version
          this replaces handed back `=SUM(...)` for every question it did not understand, in the
          same green card as a real answer, above the same green button. */}
      {suggestion && (
        <div
          className={clsx(
            "mt-1 flex flex-col gap-2 rounded-md border p-3",
            suggestion.formula ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
          )}
        >
          {suggestion.formula ? (
            <>
              <code className="text-sm font-semibold text-emerald-900">{suggestion.formula}</code>
              <p className="text-xs text-emerald-700">{suggestion.explanation}</p>
              {suggestion.source === "heuristic" && (
                <p className="text-[10px] text-emerald-400">{t.ai.heuristicNote}</p>
              )}
              <button
                onClick={() => onInsert(suggestion.formula!)}
                className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
              >
                {t.ai.insertAt(selectionAddress.split(":")[0])}
              </button>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-amber-800">{suggestion.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
