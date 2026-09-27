// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, Cloud, FileDown, FileSpreadsheet, FileText, FileUp, Plug, Rows3, Columns3, X } from "lucide-react";
import clsx from "clsx";
import { useSheetStore } from "@/store/sheetStore";
import { isCloudConfigured } from "@/lib/cloud/config";
import { useT } from "@/i18n";

/**
 * Everything the phone's top row used to hold past the right edge, as a list with a name on every
 * line.
 *
 * "Connect" comes first because it is the group a person went looking for and could not find: the
 * way to an API or a database used to be one unlabelled icon, and on the public demo nothing at
 * all. Its line names the four kinds of source, so somebody scanning for "database" finds the word
 * PostgreSQL rather than having to guess that a cylinder icon leads there.
 */
export default function MobileMenu({ onClose, onImport }: { onClose: () => void; onImport: () => void }) {
  const t = useT();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const setSidebarMode = useSheetStore((s) => s.setSidebarMode);
  const exportXlsx = useSheetStore((s) => s.exportXlsx);
  const exportPdf = useSheetStore((s) => s.exportPdf);
  const exportCsv = useSheetStore((s) => s.exportCsv);
  const addRow = useSheetStore((s) => s.addRow);
  const addColumn = useSheetStore((s) => s.addColumn);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => opener?.focus?.();
  }, []);

  // Escape closes and Tab stays inside, like every other dialog here. Capture, so the grid's own
  // Escape handling does not see the key first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const stops = [...panelRef.current.querySelectorAll<HTMLElement>("a, button")];
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
  }, [onClose]);

  /** Every line does its thing and then gets out of the way — the result is on the grid behind. */
  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const row = (icon: ReactNode, label: string, hint?: string, strong?: boolean) => (
    <>
      <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", strong ? "bg-emerald-100 text-emerald-800" : "text-zinc-600")}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className={clsx("text-sm", strong ? "font-semibold text-emerald-900" : "text-zinc-800")}>{label}</span>
        {hint && <span className="text-xs text-zinc-600">{hint}</span>}
      </span>
    </>
  );
  const line = "flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-50";
  const heading = "px-2 pt-3 pb-1 font-mono text-[10.5px] font-medium uppercase tracking-wide text-zinc-500";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:hidden">
      <div onClick={onClose} aria-hidden className="absolute inset-0 bg-zinc-900/40" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
          <h2 id={titleId} className="text-base font-semibold text-zinc-900">
            {t.menu.title}
          </h2>
          <button onClick={onClose} className="-mr-2 flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-zinc-600 hover:bg-zinc-100">
            <X size={16} aria-hidden /> {t.app.close}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <p className={heading}>{t.menu.connect}</p>
          <button onClick={act(() => setSidebarMode("data"))} className={clsx(line, "bg-emerald-50 hover:bg-emerald-100")}>
            {row(<Plug size={17} />, t.menu.connectApi, t.menu.connectApiHint, true)}
            <ChevronRight size={16} className="text-emerald-800" aria-hidden />
          </button>
          {isCloudConfigured() && (
            <button onClick={act(() => setSidebarMode("cloud"))} className={line}>
              {row(<Cloud size={17} />, t.cloud.title, t.menu.cloudHint)}
              <ChevronRight size={16} className="text-zinc-500" aria-hidden />
            </button>
          )}
          <Link href="/guide" onClick={onClose} className={line}>
            {row(<BookOpen size={17} />, t.menu.guide, t.menu.guideHint)}
            <ChevronRight size={16} className="text-zinc-500" aria-hidden />
          </Link>

          <p className={heading}>{t.menu.file}</p>
          <button onClick={act(onImport)} className={line}>
            {row(<FileUp size={17} />, t.toolbar.importFile, t.toolbar.importTitle)}
          </button>
          <button onClick={act(exportXlsx)} className={line}>
            {row(<FileDown size={17} />, t.toolbar.exportExcel)}
          </button>
          <button onClick={act(exportPdf)} className={line}>
            {row(<FileText size={17} />, t.toolbar.exportPdf)}
          </button>
          <button onClick={act(exportCsv)} className={line}>
            {row(<FileSpreadsheet size={17} />, t.toolbar.exportCsv)}
          </button>

          <p className={heading}>{t.menu.table}</p>
          <button onClick={act(addRow)} className={line}>
            {row(<Rows3 size={17} />, t.menu.addRow)}
          </button>
          <button onClick={act(addColumn)} className={line}>
            {row(<Columns3 size={17} />, t.menu.addColumn)}
          </button>
        </div>
      </div>
    </div>
  );
}
