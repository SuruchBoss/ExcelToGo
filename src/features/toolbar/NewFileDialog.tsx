// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useId, useRef } from "react";
import { FileDown, FilePlus, X } from "lucide-react";
import { useT } from "@/i18n";

/**
 * Asked before "New file" replaces work that is there.
 *
 * The same shape as the question before a file is opened over work (ImportChoiceDialog), for the
 * same reason: replacing a workbook without a word is how two of three people in the blind test lost
 * work. Undo brings it back, and the dialog says so; exporting first is offered too, because undo
 * lives in this tab and a file lives anywhere. Focus starts on the export, so Enter does the
 * harmless thing.
 */
export default function NewFileDialog({
  sheets,
  onExport,
  onConfirm,
  onCancel,
}: {
  sheets: number;
  onExport: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const safeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    safeRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
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
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  const option =
    "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div onClick={onCancel} aria-hidden className="absolute inset-0 bg-zinc-900/40" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-dvh w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-xl sm:pb-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-zinc-900">
            {t.newFile.title}
          </h2>
          <button
            onClick={onCancel}
            aria-label={t.newFile.cancel}
            className="-mr-1 -mt-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-zinc-700">{t.newFile.body(sheets)}</p>

        <div className="mt-4 flex flex-col gap-2">
          <button ref={safeRef} onClick={onExport} className={`${option} border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`}>
            <FileDown size={20} className="shrink-0 text-emerald-700" aria-hidden />
            {t.newFile.exportFirst}
          </button>
          <button onClick={onConfirm} className={`${option} border-zinc-300 text-zinc-900 hover:bg-zinc-50`}>
            <FilePlus size={20} className="shrink-0 text-red-700" aria-hidden />
            {t.newFile.confirm}
          </button>
          <button onClick={onCancel} className="min-h-11 rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
            {t.newFile.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
