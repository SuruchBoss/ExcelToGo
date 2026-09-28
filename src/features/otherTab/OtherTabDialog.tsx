// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useId, useRef } from "react";
import { Copy } from "lucide-react";
import { useTabStore } from "@/store/tabStore";
import { useT } from "@/i18n";

/**
 * What a second tab on the same workbook asks first (#47).
 *
 * Quietly re-reading the other tab's saves would keep the numbers right and still leave someone
 * typing into two tabs believing both are theirs, so the question is on the screen. "View only" is
 * under the cursor and on Escape: it changes nothing anywhere, where taking over turns the other tab
 * read-only — which loses nothing either, but is the bigger move of the two.
 */
export default function OtherTabDialog() {
  const t = useT();
  const asking = useTabStore((s) => s.role === "asking");
  const takeOver = useTabStore((s) => s.takeOver);
  const viewOnly = useTabStore((s) => s.viewOnly);
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const safeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!asking) return;
    safeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        viewOnly();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const stops = [...panelRef.current.querySelectorAll<HTMLElement>("button")];
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [asking, viewOnly]);

  if (!asking) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div aria-hidden className="absolute inset-0 bg-zinc-900/40" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative w-full rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-xl sm:pb-4"
      >
        <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold text-zinc-900">
          <Copy size={18} className="shrink-0 text-emerald-700" aria-hidden />
          {t.otherTab.title}
        </h2>
        <p id={bodyId} className="mt-1 text-sm leading-relaxed text-zinc-700">
          {t.otherTab.body}
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={safeRef}
            onClick={viewOnly}
            className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            {t.otherTab.viewOnly}
          </button>
          <button
            onClick={takeOver}
            className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            {t.otherTab.useHere}
          </button>
        </div>
      </div>
    </div>
  );
}
