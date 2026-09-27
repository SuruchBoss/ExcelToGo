// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, FileDown, FileText, FileSpreadsheet, Plus, Sparkles, Sigma, Undo2, Redo2, Save, Database, Cloud, Menu } from "lucide-react";
import clsx from "clsx";
import { useCanRedo, useCanUndo, redoSheet, undoSheet, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import LanguageToggle from "./LanguageToggle";
import Link from "next/link";
import { isCloudConfigured } from "@/lib/cloud/config";
import MobileMenu from "./MobileMenu";

/**
 * Is an on-screen keyboard up? A phone shrinks the visual viewport, not the layout one, when it
 * raises a keyboard, and a bar pinned to the bottom then rides up on top of it and eats a third of
 * what is left. While someone is typing into a cell they are not switching panels, so the bar goes.
 */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => setOpen(window.innerHeight - vv.height > 150);
    vv.addEventListener("resize", check);
    return () => vv.removeEventListener("resize", check);
  }, []);
  return open;
}

/**
 * One of the panel switches. From 640px up it is the toolbar button it always was; below that the
 * group it sits in is pinned to the bottom of the screen as a tab bar, and the button stacks its
 * icon over its name. The name is shown at every width — an unlabelled row of icons is how a
 * person ended up unable to find the live-data panel at all.
 */
function navButton(active: boolean) {
  return clsx(
    "flex shrink-0 items-center justify-center whitespace-nowrap font-medium",
    "max-sm:h-14 max-sm:min-w-0 max-sm:flex-col max-sm:gap-0.5 max-sm:px-0.5 max-sm:text-[11px] max-sm:leading-tight",
    "sm:gap-1.5 sm:rounded-md sm:px-3 sm:py-1.5 sm:text-sm",
    active
      ? "max-sm:font-semibold max-sm:text-emerald-800 sm:bg-emerald-700 sm:text-white"
      : "max-sm:text-zinc-600 sm:border sm:border-zinc-300 sm:text-zinc-700 sm:hover:bg-zinc-50"
  );
}

/** The icon's pill, which is how the current tab reads at a glance on a phone. */
function navIcon(active: boolean) {
  return clsx("flex items-center justify-center max-sm:h-7 max-sm:w-12 max-sm:rounded-full", active && "max-sm:bg-emerald-50");
}

const FILE_BUTTON =
  "hidden shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:flex";

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
  const cloud = isCloudConfigured();
  const [menuOpen, setMenuOpen] = useState(false);
  const keyboardOpen = useKeyboardOpen();

  return (
    // One row rather than a wrapping one. Wrapping put this bar on three lines at 360px and, with
    // the format bar and the formula bar under it, more than half a phone screen was chrome before
    // the first cell. On a phone it now holds four things and does not scroll at all; from 640px up
    // it scrolls when it has to, like the format bar under it.
    <div className="flex items-center gap-1.5 scroll-hint-x overflow-x-auto border-b border-zinc-200 bg-white px-2 py-1.5 sm:px-4 sm:py-2">
      {/* The brand doubles as the way back to the landing page, the way it does on most sites. */}
      <Link href="/" title={t.landing.home} className="mr-2 shrink-0 text-lg font-bold text-emerald-700 hover:text-emerald-800">
        {t.app.brand}
      </Link>
      {/* On a phone the row is the brand, then undo, redo and the language — nothing that scrolls
          out of sight. The busy message lives here too, since the tab bar has no room for words
          that are not tab names. */}
      <div className="flex min-w-0 flex-1 items-center sm:hidden">
        {busy && <span className="truncate text-xs text-zinc-500">{busy}</span>}
      </div>

      <button
        onClick={() => fileInputRef.current?.click()}
        aria-label={t.toolbar.importFile}
        title={t.toolbar.importTitle}
        className={FILE_BUTTON}
      >
        <FileUp size={15} /> {t.toolbar.importFile}
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
        className={FILE_BUTTON}
      >
        <FileDown size={15} /> {t.toolbar.exportExcel}
      </button>

      <button
        onClick={exportPdf}
        aria-label={t.toolbar.exportPdf}
        className={FILE_BUTTON}
      >
        <FileText size={15} /> {t.toolbar.exportPdf}
      </button>

      {/* CSV sits beside the other two exports rather than behind a menu: it is the format every
          other tool reads, and a third button costs less than a dropdown people have to find. */}
      <button
        onClick={exportCsv}
        aria-label={t.toolbar.exportCsv}
        className={FILE_BUTTON}
      >
        <FileSpreadsheet size={15} /> {t.toolbar.exportCsv}
      </button>

      <div className="mx-1 hidden h-5 w-px shrink-0 bg-zinc-200 sm:block" />

      <button
        onClick={undoSheet}
        disabled={!canUndo}
        title={t.toolbar.undoTitle}
        aria-label={t.toolbar.undoTitle}
        className="flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Undo2 size={15} />
      </button>
      <button
        onClick={redoSheet}
        disabled={!canRedo}
        title={t.toolbar.redoTitle}
        aria-label={t.toolbar.redoTitle}
        className="flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Redo2 size={15} />
      </button>

      <div className="mx-1 hidden h-5 w-px shrink-0 bg-zinc-200 sm:block" />

      <button
        onClick={addRow}
        aria-label={t.toolbar.addRow}
        className="hidden shrink-0 whitespace-nowrap items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 sm:flex"
      >
        <Plus size={14} /> {t.toolbar.addRow}
      </button>
      <button
        onClick={addColumn}
        aria-label={t.toolbar.addColumn}
        className="hidden shrink-0 whitespace-nowrap items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 sm:flex"
      >
        <Plus size={14} /> {t.toolbar.addColumn}
      </button>

      {/* Measured at 390px: this row was 784px of content in a 390px box, and "ask AI" — the thing
          the landing page leads with — sat two hundred pixels past the right edge. Moving the group
          to the front helped a little; the icons still had no names, and the person who wrote the
          app could not find live data on their own phone. So below 640px this group leaves the row
          altogether and becomes a tab bar along the bottom, where a thumb reaches and every tab
          says what it is. From 640px up it is back in the row on the right, unchanged. */}
      <nav
        aria-label={t.menu.navLabel}
        className={clsx(
          "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-[35] max-sm:grid max-sm:auto-cols-fr max-sm:grid-flow-col max-sm:border-t max-sm:border-zinc-200 max-sm:bg-white max-sm:pb-[env(safe-area-inset-bottom)]",
          "sm:ml-auto sm:flex sm:shrink-0 sm:items-center sm:gap-1.5",
          keyboardOpen && "max-sm:hidden"
        )}
      >
        {busy ? (
          <span className="hidden text-xs text-zinc-500 sm:inline">{busy}</span>
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
        <button onClick={() => toggleSidebar("palette")} aria-label={t.toolbar.formulas} aria-pressed={paletteOpen} className={navButton(paletteOpen)}>
          <span className={navIcon(paletteOpen)}>
            <Sigma size={17} className="sm:size-[15px]" />
          </span>
          {t.toolbar.formulas}
        </button>
        <button onClick={() => toggleSidebar("ai")} aria-label={t.toolbar.askAi} aria-pressed={aiOpen} className={navButton(aiOpen)}>
          <span className={navIcon(aiOpen)}>
            <Sparkles size={17} className="sm:size-[15px]" />
          </span>
          {t.toolbar.askAi}
        </button>
        <button onClick={() => toggleSidebar("data")} aria-label={t.toolbar.data} aria-pressed={dataOpen} className={navButton(dataOpen)}>
          <span className={navIcon(dataOpen)}>
            <Database size={17} className="sm:size-[15px]" />
          </span>
          {t.toolbar.data}
        </button>
        {/* Absent, not disabled, when no cloud backend is configured — which is the default. The
            app is open source, not a hosted service: you point it at your own Supabase project or
            you get the same browser-only app as before. See src/lib/cloud/config.ts.
            The tab says "save" in its name on purpose: shown as a bare cloud it was read as the way
            to connect a database, which it is not. */}
        {cloud && (
          <button onClick={() => toggleSidebar("cloud")} aria-pressed={cloudOpen} className={navButton(cloudOpen)}>
            <span className={navIcon(cloudOpen)}>
              <Cloud size={17} className="sm:size-[15px]" />
            </span>
            <span className="sm:hidden">{t.toolbar.cloudShort}</span>
            <span className="hidden sm:inline">{t.cloud.title}</span>
          </button>
        )}
        <button
          onClick={() => setMenuOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          className={clsx(navButton(menuOpen), "sm:hidden")}
        >
          <span className={navIcon(menuOpen)}>
            <Menu size={17} />
          </span>
          {t.menu.open}
        </button>
      </nav>
      <LanguageToggle />
      {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} onImport={() => fileInputRef.current?.click()} />}
    </div>
  );
}
