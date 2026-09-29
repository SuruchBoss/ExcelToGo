// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";

/**
 * Asked before a sort that would give formulas another row's numbers (#48).
 *
 * A formula that only uses its own row moves with the row and stays right. One that points at
 * another row — a running total, a grand total caught in the range — cannot come through a sort
 * right in any spreadsheet. Excel sorts it without a word; the blind test showed what that costs
 * (a total 2,710 baht off, and a tester going back to Excel). So the question is asked, with Cancel
 * under the cursor, and "sort anyway" still there for the person who means it.
 */
export default function SortWarningDialog() {
  const t = useT();
  const warning = useSheetStore((s) => s.sortWarning);
  const dismiss = useSheetStore((s) => s.dismissSortWarning);
  const sortSelection = useSheetStore((s) => s.sortSelection);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const safeRef = useRef<HTMLButtonElement>(null);
  const open = warning !== null;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    safeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
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
  }, [open, dismiss]);

  if (!warning) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div onClick={dismiss} aria-hidden className="absolute inset-0 bg-zinc-900/40" />
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
            {t.sortWarning.title}
          </h2>
          <button
            onClick={dismiss}
            aria-label={t.sortWarning.cancel}
            className="-mr-1 -mt-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-zinc-700">{t.sortWarning.body(warning.formulas)}</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={() => sortSelection(warning.ascending, true)}
            className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            {t.sortWarning.sortAnyway}
          </button>
          <button
            ref={safeRef}
            onClick={dismiss}
            className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            {t.sortWarning.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
