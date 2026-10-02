// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * The question asked before an action that could change numbers nobody is looking at — a sort
 * that would give formulas another row's numbers (#48), a paste over rows a filter hides (#50).
 *
 * The same shape every time on purpose: Cancel under the cursor, the action still there for the
 * person who means it, Escape and the backdrop both cancel, focus stays inside while it is open and
 * goes back where it came from after. Excel does both actions without a word; the blind test showed
 * what a wrong number with no error costs.
 */
export default function AskFirstDialog({
  title,
  body,
  proceed,
  cancel,
  onProceed,
  onCancel,
}: {
  title: string;
  body: string;
  proceed: string;
  cancel: string;
  onProceed: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const safeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    safeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
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
    return () => {
      window.removeEventListener("keydown", onKey, true);
      opener?.focus?.();
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div onClick={onCancel} aria-hidden className="absolute inset-0 bg-zinc-900/40" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-dvh w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-xl sm:pb-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold text-zinc-900">
            <AlertTriangle size={18} className="shrink-0 text-amber-600" aria-hidden />
            {title}
          </h2>
          <button
            onClick={onCancel}
            aria-label={cancel}
            className="-mr-1 -mt-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-zinc-700">{body}</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onProceed}
            className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            {proceed}
          </button>
          <button
            ref={safeRef}
            onClick={onCancel}
            className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            {cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
