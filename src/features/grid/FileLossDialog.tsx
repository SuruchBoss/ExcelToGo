// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useId, useRef } from "react";
import { FileWarning, X } from "lucide-react";
import { selectFileLosses, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";

/**
 * What the file just opened holds that the app does not keep (#83).
 *
 * The app is used to open a file, fix it and send it back. When the file has pictures, Excel's own
 * charts, a PivotTable or macros, sending it back loses them — and the person used to find out from
 * whoever received it. So the list comes up as the file opens, before the first edit, with counts
 * and the sheets they are on. It shows only when something is found: most files see nothing.
 *
 * It is a dialog rather than one more notice above the grid (#129 left room for one message at a
 * time there), and it can be opened again from the menu for as long as the file's tabs are open.
 * It says what is *known* not to be kept, never "everything" — the detector does not cover every
 * kind yet (see `fileLosses.ts`).
 */
export default function FileLossDialog() {
  const t = useT();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const report = useSheetStore(selectFileLosses);
  const open = useSheetStore((s) => s.fileLossesOpen);
  const close = useSheetStore((s) => s.closeFileLosses);
  const showing = open && report !== null;

  useEffect(() => {
    if (!showing) return;
    const opener = document.activeElement as HTMLElement | null;
    okRef.current?.focus();
    return () => opener?.focus?.();
  }, [showing]);

  useEffect(() => {
    if (!showing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
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
  }, [showing, close]);

  if (!showing) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div onClick={close} aria-hidden className="absolute inset-0 bg-zinc-900/40" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-dvh w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-lg sm:rounded-xl sm:pb-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold text-zinc-900">
            <FileWarning size={18} className="shrink-0 text-amber-700" aria-hidden />
            {t.fileLosses.title}
          </h2>
          <button
            onClick={close}
            aria-label={t.fileLosses.understood}
            className="-mr-1 -mt-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-zinc-700">{t.fileLosses.intro(report.fileName, report.items.length)}</p>
        <ul className="mt-3 space-y-2">
          {report.items.map((item) => (
            <li key={item.kind} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <span className="font-semibold">{t.fileLosses.item[item.kind](item.count, item.names ?? [])}</span>
              {t.fileLosses.onSheets(item.sheets)}
              {t.fileLosses.detail[item.kind] && <span className="mt-0.5 block text-xs text-amber-900">{t.fileLosses.detail[item.kind]}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">{t.fileLosses.notComplete}</p>
        <div className="mt-4 flex justify-end">
          <button
            ref={okRef}
            onClick={close}
            className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            {t.fileLosses.understood}
          </button>
        </div>
      </div>
    </div>
  );
}
