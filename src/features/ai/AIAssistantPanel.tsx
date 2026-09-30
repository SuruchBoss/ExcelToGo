// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { countUsage } from "@/lib/usage";
import { Sparkles, Loader2, KeyRound, ExternalLink, ChevronDown, TriangleAlert } from "lucide-react";
import clsx from "clsx";
import { selectActiveSheet, useAIContext, useSheetStore } from "@/store/sheetStore";
import { placeFormula } from "@/lib/aiPlacement";
import { getFormulaById } from "@/lib/formulaCatalog";
import { cellRef } from "@/lib/formulaEngine/address";
import type { AskContext } from "@/lib/aiHeuristic";
import { useLocale, useT } from "@/i18n";
import { clearKey, keyServerSnapshot, keySnapshot, looksLikeAnthropicKey, maskKey, saveKey, subscribeToKey } from "@/lib/byok";
import { askAnthropicDirect } from "./askAnthropicDirect";

interface Suggestion {
  /** `null` when the keyword matcher had no rule for the question — see aiHeuristic.ts. */
  formula: string | null;
  explanation: string;
  source: "ai" | "heuristic";
  /** The palette form a declined answer points at (#62). */
  form?: string;
}

export default function AIAssistantPanel() {
  const t = useT();
  const locale = useLocale();
  const { address: selectionAddress, range, headers, anchor, row, rangeIsText, columns, mentionsIn } = useAIContext();
  const onInsert = useSheetStore((s) => s.insertAIFormula);
  const openFormulaPanel = useSheetStore((s) => s.openFormulaPanel);
  const sheet = useSheetStore(selectActiveSheet);
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
  // The key settings fold away: they used to sit above the question and squeeze it to one clipped
  // line at 1366×768, when the question is what people open this panel for.
  const [keyOpen, setKeyOpen] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  // Where Insert would write, by the same rule the store follows (#64): not into a cell the formula
  // reads — under the column for a total, and nowhere when there is no such cell.
  const place = useMemo(
    () =>
      suggestion?.formula
        ? placeFormula(suggestion.formula, anchor, (r, c) => sheet.cells[r]?.[c] ?? "", sheet.rows, sheet.names)
        : null,
    [suggestion, anchor, sheet]
  );
  const placeAddress = place ? cellRef(place.row, place.col) : null;
  const target = place ? (sheet.cells[place.row]?.[place.col] ?? "") : "";

  // The answer arrives below the fold on a laptop screen; bring it into view rather than leave
  // someone wondering whether anything happened.
  useEffect(() => {
    if (suggestion) answerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [suggestion]);

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
    // Before the branch, so it counts the same whether the answer comes from this app's server or
    // straight from the visitor's own key — "somebody asked" is the fact, and where it went is
    // already their choice.
    countUsage("ai_asked");
    setLoading(true);
    setError(null);
    setSuggestion(null);
    // What the keyword matcher needs to answer without guessing (#62–#64); it runs on the server when
    // there is no key, so it cannot read the sheet itself.
    const context: AskContext = { range, rangeIsText, row, columns, mentions: mentionsIn(q) };
    try {
      // With the visitor's own key the request never touches this app's server — see byok.ts.
      // `range`, not `selectionAddress`: with a single cell highlighted those differ, and the
      // range is the one that makes "add up this column" mean a column. See aiRange.ts.
      if (savedKey) {
        setSuggestion(await askAnthropicDirect(savedKey, q, range, locale, headers, context));
        return;
      }
      const res = await fetch("/api/ai/formula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, selection: range, headers, locale, context }),
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
        className="min-h-[4.5rem] w-full shrink-0 resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
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
          ref={answerRef}
          className={clsx(
            "mt-1 flex flex-col gap-2 rounded-md border p-3",
            suggestion.formula ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
          )}
        >
          {suggestion.formula ? (
            <>
              {/* A guess says it is one before anything else, and its insert button is the quieter
                  kind: the big green button under a keyword guess read as a real answer, and the
                  note saying otherwise was 1.84:1 grey-green that nobody could read. */}
              {suggestion.source === "heuristic" && (
                <span className="self-start rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  {t.ai.guessBadge}
                </span>
              )}
              <code className="text-sm font-semibold text-emerald-900">{suggestion.formula}</code>
              <p className="text-xs text-emerald-800">{suggestion.explanation}</p>
              {suggestion.source === "heuristic" && <p className="text-[11px] leading-relaxed text-zinc-700">{t.ai.heuristicNote}</p>}
              {placeAddress === null ? (
                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-900">
                  <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden />
                  {t.ai.selfReference(cellRef(anchor.row, anchor.col))}
                </p>
              ) : (
                <>
                  {target !== "" && (
                    <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-900">
                      <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden />
                      {t.ai.overwriteWarning(placeAddress)}
                    </p>
                  )}
                  <button
                    onClick={() => onInsert(suggestion.formula!)}
                    className={clsx(
                      "rounded-md px-3 py-1.5 text-xs font-medium",
                      suggestion.source === "heuristic"
                        ? "border border-emerald-700 bg-white text-emerald-800 hover:bg-emerald-100"
                        : "bg-emerald-700 text-white hover:bg-emerald-800"
                    )}
                  >
                    {t.ai.insertAt(placeAddress)}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-amber-800">{suggestion.explanation}</p>
              {/* Not sure is not a dead end (#62): the form that fits the question, one press away. */}
              {suggestion.form && getFormulaById(t, suggestion.form) && (
                <button
                  onClick={() => openFormulaPanel(getFormulaById(t, suggestion.form!)!, anchor.row, anchor.col)}
                  className="self-start rounded-md border border-amber-700 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                >
                  {t.ai.openForm(suggestion.form)}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Bring your own key. It used to sit above the question and push it down to one clipped
          line; now it is one line under the answer that says what it does, and opens when asked.
          A key already in use keeps it open — that line says which key, which is worth seeing. */}
      <div className="rounded-md border border-zinc-200 bg-white p-2.5">
        <button
          type="button"
          onClick={() => setKeyOpen((v) => !v)}
          aria-expanded={keyOpen || Boolean(savedKey)}
          aria-controls="byok-body"
          className="flex min-h-9 w-full items-center gap-1.5 text-left text-xs font-semibold text-zinc-700"
        >
          <KeyRound size={13} className="text-emerald-600" aria-hidden />
          <span className="flex-1">{t.ai.byok.title}</span>
          <ChevronDown size={14} aria-hidden className={clsx("transition-transform", (keyOpen || savedKey) && "rotate-180")} />
        </button>
        {(keyOpen || savedKey) && (
        <div id="byok-body">

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

        {/* zinc-400 on white is 2.85:1 — the same failure the shortcut dialog had, in the same
            rule, found the same way: by opening the thing before scanning it. */}
        <p className="mt-2 border-t border-zinc-100 pt-2 text-[10px] leading-relaxed text-zinc-500">
          {t.ai.byok.privacyNote}
        </p>
        {/* The other half of the same truth, and it goes next to the box rather than in the README:
            a key kept in a page is readable by anything running in that page. The advice that
            follows from it — bring one you can throw away — is only useful before the paste, so it
            is here and not in a doc nobody opens. */}
        <p className="mt-1.5 text-[10px] leading-relaxed text-amber-700">{t.ai.byok.keyAdviceNote}</p>
        </div>
        )}
      </div>

    </div>
  );
}
