// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useRef } from "react";
import { FileUp, FileDown, FileText, FileSpreadsheet, Plus, Sparkles, Sigma, Undo2, Redo2, Save, Database, Cloud } from "lucide-react";
import { useCanRedo, useCanUndo, redoSheet, undoSheet, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import LanguageToggle from "./LanguageToggle";
import Link from "next/link";
import { isCloudConfigured } from "@/lib/cloud/config";

export default function Toolbar() {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = useSheetStore((s) => s.busy);
  const sidebarMode = useSheetStore((s) => s.sidebarMode);
  const hasPending = useSheetStore((s) => s.pending !== null);
  const importFromFile = useSheetStore((s) => s.importFromFile);
  const exportXlsx = useSheetStore((s) => s.exportXlsx);
  const exportPdf = useSheetStore((s) => s.exportPdf);
  const exportCsv = useSheetStore((s) => s.exportCsv);
  const addRow = useSheetStore((s) => s.addRow);
  const addColumn = useSheetStore((s) => s.addColumn);
  const toggleSidebar = useSheetStore((s) => s.toggleSidebar);
  const cloudOpen = useSheetStore((s) => s.sidebarMode === "cloud");
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  const paletteOpen = sidebarMode === "palette" && !hasPending;
  const aiOpen = sidebarMode === "ai" && !hasPending;
  const dataOpen = sidebarMode === "data" && !hasPending;

  return (
    // One scrolling row rather than a wrapping one. Wrapping put this bar on three lines at 360px
    // and, with the format bar and the formula bar under it, more than half a phone screen was
    // chrome before the first cell. The format bar beside it already scrolls; matching it keeps the
    // two rows the same height and the same gesture.
    <div className="flex items-center gap-1.5 scroll-hint-x overflow-x-auto border-b border-zinc-200 bg-white px-2 py-1.5 sm:gap-2 sm:px-4 sm:py-2">
      {/* The brand doubles as the way back to the landing page, the way it does on most sites.
          `order-first` here and on the action group below is what keeps the two of them at the head
          of the row on a phone; see the note on that group. */}
      <Link href="/" title={t.landing.home} className="order-first sm:order-none mr-2 shrink-0 text-lg font-bold text-emerald-700 hover:text-emerald-800">
        {t.app.brand}
      </Link>

      <button
        onClick={() => fileInputRef.current?.click()}
        aria-label={t.toolbar.importFile}
        title={t.toolbar.importTitle}
        className="flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5"
      >
        <FileUp size={15} /> <span className="hidden sm:inline">{t.toolbar.importFile}</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importFromFile(file);
          e.target.value = "";
        }}
      />

      <button
        onClick={exportXlsx}
        aria-label={t.toolbar.exportExcel}
        className="flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5"
      >
        <FileDown size={15} /> <span className="hidden sm:inline">{t.toolbar.exportExcel}</span>
      </button>

      <button
        onClick={exportPdf}
        aria-label={t.toolbar.exportPdf}
        className="flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5"
      >
        <FileText size={15} /> <span className="hidden sm:inline">{t.toolbar.exportPdf}</span>
      </button>

      {/* CSV sits beside the other two exports rather than behind a menu: it is the format every
          other tool reads, and a third button costs less than a dropdown people have to find. */}
      <button
        onClick={exportCsv}
        aria-label={t.toolbar.exportCsv}
        className="flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5"
      >
        <FileSpreadsheet size={15} /> <span className="hidden sm:inline">{t.toolbar.exportCsv}</span>
      </button>

      <div className="mx-1 h-5 w-px shrink-0 bg-zinc-200" />

      <button
        onClick={undoSheet}
        disabled={!canUndo}
        title={t.toolbar.undoTitle}
        className="flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Undo2 size={15} />
      </button>
      <button
        onClick={redoSheet}
        disabled={!canRedo}
        title={t.toolbar.redoTitle}
        className="flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Redo2 size={15} />
      </button>

      <div className="mx-1 h-5 w-px shrink-0 bg-zinc-200" />

      <button
        onClick={addRow}
        aria-label={t.toolbar.addRow}
        className="flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:py-1.5"
      >
        <Plus size={14} /> <span className="hidden sm:inline">{t.toolbar.addRow}</span>
      </button>
      <button
        onClick={addColumn}
        aria-label={t.toolbar.addColumn}
        className="flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:py-1.5"
      >
        <Plus size={14} /> <span className="hidden sm:inline">{t.toolbar.addColumn}</span>
      </button>

      {/* Measured at 390px: this row is 784px of content in a 390px box, and "ask AI" — the thing the
          landing page leads with — sat at x=592, two hundred pixels past the right edge. The scroll
          shadow says there is more, but the one button worth finding first should not be the one you
          have to go looking for. On a phone this group is ordered to the front, right after the
          brand; from `sm:` up `order-none` and `ml-auto` put it back on the right, unchanged. */}
      <div className="order-first sm:order-none sm:ml-auto flex shrink-0 items-center gap-2">
        {busy ? (
          <span className="text-xs text-zinc-500">{busy}</span>
        ) : (
          // The word only from 2xl up. Below that the row overflowed a 1366px laptop by 41px in
          // English — enough to push the language toggle, the one control a reader of the wrong
          // language is looking for, half off the edge. The icon stays, and the word stays for a
          // screen reader, which never had a width to run out of.
          // `relative` because `sr-only` is `position: absolute`: without a positioned parent the
          // hidden word escaped the toolbar's own scroll box and widened the page by 86px at 820.
          <span title={t.toolbar.autosaveTitle} className="relative hidden shrink-0 items-center gap-1 whitespace-nowrap text-xs text-zinc-500 sm:flex">
            <Save size={13} aria-hidden /> <span className="sr-only 2xl:not-sr-only">{t.toolbar.autosaveLabel}</span>
          </span>
        )}
        <button
          onClick={() => toggleSidebar("palette")}
          aria-label={t.toolbar.formulas}
          className={`flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5 ${
            paletteOpen ? "bg-emerald-700 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <Sigma size={15} /> <span className="hidden sm:inline">{t.toolbar.formulas}</span>
        </button>
        <button
          onClick={() => toggleSidebar("ai")}
          aria-label={t.toolbar.askAi}
          className={`flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5 ${
            aiOpen ? "bg-emerald-700 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <Sparkles size={15} /> <span className="hidden sm:inline">{t.toolbar.askAi}</span>
        </button>
        <button
          onClick={() => toggleSidebar("data")}
          aria-label={t.toolbar.data}
          className={`flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5 ${
            dataOpen ? "bg-emerald-700 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <Database size={15} /> <span className="hidden sm:inline">{t.toolbar.data}</span>
        </button>
        {/* Absent, not disabled, when no cloud backend is configured — which is the default. The
            app is open source, not a hosted service: you point it at your own Supabase project or
            you get the same browser-only app as before. See src/lib/cloud/config.ts. */}
        {isCloudConfigured() && (
          <button
            onClick={() => toggleSidebar("cloud")}
            aria-label={t.cloud.title}
            className={`flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5 ${
              cloudOpen ? "bg-emerald-700 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            <Cloud size={15} /> <span className="hidden sm:inline">{t.cloud.title}</span>
          </button>
        )}
        <LanguageToggle />
      </div>
    </div>
  );
}
