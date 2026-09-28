// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useRef, useState } from "react";
import { FilePlus, FileUp, FileDown, FileText, FileSpreadsheet, Plus, Sparkles, Sigma, Undo2, Redo2, Save, Database, Cloud, Menu } from "lucide-react";
import clsx from "clsx";
import { selectHasWork, useCanRedo, useCanUndo, redoSheet, undoSheet, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import LanguageToggle from "./LanguageToggle";
import Link from "next/link";
import { isCloudConfigured } from "@/lib/cloud/config";
import MobileMenu from "./MobileMenu";
import { useKeyboardOpen } from "./useKeyboardOpen";
import ImportChoiceDialog from "./ImportChoiceDialog";
import NewFileDialog from "./NewFileDialog";

/**
 * One of the panel switches. From 1024px up it is the toolbar button it always was; below that the
 * group it sits in is pinned to the bottom of the screen as a tab bar, and the button stacks its
 * icon over its name. The name is shown at every width — an unlabelled row of icons is how a
 * person ended up unable to find the live-data panel at all.
 */
function navButton(active: boolean) {
  return clsx(
    "flex shrink-0 items-center justify-center whitespace-nowrap font-medium",
    "max-lg:h-14 max-lg:min-w-0 max-lg:flex-col max-lg:gap-0.5 max-lg:px-0.5 max-lg:text-[11px] max-lg:leading-tight",
    "lg:gap-1.5 lg:rounded-md lg:px-3 lg:py-1.5 lg:text-sm",
    active
      ? "max-lg:font-semibold max-lg:text-emerald-800 lg:bg-emerald-700 lg:text-white"
      : "max-lg:text-zinc-600 lg:border lg:border-zinc-300 lg:text-zinc-700 lg:hover:bg-zinc-50"
  );
}

/** The icon's pill, which is how the current tab reads at a glance on a phone. */
function navIcon(active: boolean) {
  return clsx("flex items-center justify-center max-lg:h-7 max-lg:w-12 max-lg:rounded-full", active && "max-lg:bg-emerald-50");
}

/**
 * The file buttons come into the row in two steps, at the narrowest widths each was measured to fit
 * in both languages. Import and Export Excel — the pair a spreadsheet is opened and sent with — from
 * 1280px, the most common laptop width, where hiding them behind a menu cost every visit a press.
 * PDF and CSV from 1366px. Below that they all live in the menu: at 1024px the four were most of
 * the 251px the row overflowed by, and what they pushed off the edge was "Ask AI".
 */
const FILE_BUTTON_BASE =
  "hidden shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50";
const FILE_BUTTON_MAIN = `${FILE_BUTTON_BASE} min-[1280px]:flex`;
const FILE_BUTTON = `${FILE_BUTTON_BASE} min-[1366px]:flex`;

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
  // A file waiting on the keep-or-replace question. Asked only when there is work to lose.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const sheetCount = useSheetStore((s) => s.sheets.length);
  const startBlank = useSheetStore((s) => s.startBlank);
  const [askNewFile, setAskNewFile] = useState(false);
  // Asked only when there is something to lose; on an empty workbook or the untouched sample a
  // question would be one more thing to click through.
  const newFile = () => (selectHasWork(useSheetStore.getState()) ? setAskNewFile(true) : startBlank());
  const keyboardOpen = useKeyboardOpen();

  return (
    // One row rather than a wrapping one. Wrapping put this bar on three lines at 360px and, with
    // the format bar and the formula bar under it, more than half a phone screen was chrome before
    // the first cell. Below 1024px it now holds four things and does not scroll at all; from 1024px up
    // it scrolls when it has to, like the format bar under it.
    <div className="flex items-center gap-1.5 scroll-hint-x overflow-x-auto border-b border-zinc-200 bg-white px-2 py-1.5 sm:px-4 sm:py-2">
      {/* The brand doubles as the way back to the landing page, the way it does on most sites. */}
      <Link href="/" title={t.landing.home} className="mr-2 shrink-0 text-lg font-bold text-emerald-700 hover:text-emerald-800">
        {t.app.brand}
      </Link>
      {/* On a phone the row is the brand, then undo, redo and the language — nothing that scrolls
          out of sight. The busy message lives here too, since the tab bar has no room for words
          that are not tab names. */}
      <div className="flex min-w-0 flex-1 items-center lg:hidden">
        {busy && <span className="truncate text-xs text-zinc-500">{busy}</span>}
      </div>

      {/* An icon from 1024px up, beside the file buttons, like undo and redo: the row was measured
          to the pixel at 1280 and 1366 in both languages, and a worded button would push "Ask AI"
          off the edge again. The name is its tooltip and what a screen reader says; below 1024px it
          is a worded line at the top of the menu's File group. */}
      <button
        onClick={newFile}
        aria-label={t.newFile.button}
        title={`${t.newFile.button} — ${t.newFile.hint}`}
        className="hidden min-w-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 px-2 py-1.5 text-zinc-700 hover:bg-zinc-50 lg:flex"
      >
        <FilePlus size={15} />
      </button>
      <button
        onClick={() => fileInputRef.current?.click()}
        aria-label={t.toolbar.importFile}
        title={t.toolbar.importTitle}
        className={FILE_BUTTON_MAIN}
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
          if (!file) return;
          if (selectHasWork(useSheetStore.getState())) setPendingFile(file);
          else void importFromFile(file, "replace");
          e.target.value = "";
        }}
      />

      <button
        onClick={exportXlsx}
        aria-label={t.toolbar.exportExcel}
        className={FILE_BUTTON_MAIN}
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

      <div className="mx-1 hidden h-5 w-px shrink-0 bg-zinc-200 lg:block" />

      <button
        onClick={undoSheet}
        disabled={!canUndo}
        title={t.toolbar.undoTitle}
        aria-label={t.toolbar.undoTitle}
        className="flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 lg:min-h-0 lg:min-w-0 lg:justify-start lg:py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Undo2 size={15} />
      </button>
      <button
        onClick={redoSheet}
        disabled={!canRedo}
        title={t.toolbar.redoTitle}
        aria-label={t.toolbar.redoTitle}
        className="flex shrink-0 whitespace-nowrap min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 lg:min-h-0 lg:min-w-0 lg:justify-start lg:py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Redo2 size={15} />
      </button>

      <div className="mx-1 hidden h-5 w-px shrink-0 bg-zinc-200 lg:block" />

      <button
        onClick={addRow}
        aria-label={t.toolbar.addRow}
        className="hidden shrink-0 whitespace-nowrap items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 lg:flex"
      >
        <Plus size={14} /> {t.toolbar.addRow}
      </button>
      <button
        onClick={addColumn}
        aria-label={t.toolbar.addColumn}
        className="hidden shrink-0 whitespace-nowrap items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 lg:flex"
      >
        <Plus size={14} /> {t.toolbar.addColumn}
      </button>

      {/* Measured at 390px: this row was 784px of content in a 390px box, and "ask AI" — the thing
          the landing page leads with — sat two hundred pixels past the right edge. Moving the group
          to the front helped a little; the icons still had no names, and the person who wrote the
          app could not find live data on their own phone. So below 1024px this group leaves the row
          altogether and becomes a tab bar along the bottom, where a thumb reaches and every tab
          says what it is — tablets and folding phones too: at 820px the row was still 487px wider than
          the screen. From 1024px up it is back in the row on the right. */}
      <nav
        aria-label={t.menu.navLabel}
        className={clsx(
          "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[35] max-lg:grid max-lg:auto-cols-fr max-lg:grid-flow-col max-lg:border-t max-lg:border-zinc-200 max-lg:bg-white max-lg:pb-[env(safe-area-inset-bottom)]",
          "lg:ml-auto lg:flex lg:shrink-0 lg:items-center lg:gap-1.5",
          keyboardOpen && "max-lg:hidden"
        )}
      >
        {busy ? (
          <span className="hidden text-xs text-zinc-500 lg:inline">{busy}</span>
        ) : (
          // The word only from 2xl up. Below that the row overflowed a 1366px laptop by 41px in
          // English — enough to push the language toggle, the one control a reader of the wrong
          // language is looking for, half off the edge. The icon stays, and the word stays for a
          // screen reader, which never had a width to run out of.
          // `relative` because `sr-only` is `position: absolute`: without a positioned parent the
          // hidden word escaped the toolbar's own scroll box and widened the page by 86px at 820.
          <span title={t.toolbar.autosaveTitle} className="relative hidden shrink-0 items-center gap-1 whitespace-nowrap text-xs text-zinc-500 lg:flex">
            <Save size={13} aria-hidden /> <span className="sr-only 2xl:not-sr-only">{t.toolbar.autosaveLabel}</span>
          </span>
        )}
        <button onClick={() => toggleSidebar("palette")} aria-label={t.toolbar.formulas} aria-pressed={paletteOpen} className={navButton(paletteOpen)}>
          <span className={navIcon(paletteOpen)}>
            <Sigma size={17} className="lg:size-[15px]" />
          </span>
          {t.toolbar.formulas}
        </button>
        <button onClick={() => toggleSidebar("ai")} aria-label={t.toolbar.askAi} aria-pressed={aiOpen} className={navButton(aiOpen)}>
          <span className={navIcon(aiOpen)}>
            <Sparkles size={17} className="lg:size-[15px]" />
          </span>
          {t.toolbar.askAi}
        </button>
        <button onClick={() => toggleSidebar("data")} aria-label={t.toolbar.data} aria-pressed={dataOpen} className={navButton(dataOpen)}>
          <span className={navIcon(dataOpen)}>
            <Database size={17} className="lg:size-[15px]" />
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
              <Cloud size={17} className="lg:size-[15px]" />
            </span>
            <span className="lg:hidden">{t.toolbar.cloudShort}</span>
            <span className="hidden lg:inline">{t.cloud.title}</span>
          </button>
        )}
        <button
          onClick={() => setMenuOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          className={clsx(navButton(menuOpen), "min-[1366px]:hidden")}
        >
          <span className={navIcon(menuOpen)}>
            <Menu size={17} />
          </span>
          {t.menu.open}
        </button>
      </nav>
      <LanguageToggle />
      {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} onImport={() => fileInputRef.current?.click()} onNewFile={newFile} />}
      {askNewFile && (
        <NewFileDialog
          sheets={sheetCount}
          onCancel={() => setAskNewFile(false)}
          onExport={() => {
            setAskNewFile(false);
            void exportXlsx();
          }}
          onConfirm={() => {
            setAskNewFile(false);
            startBlank();
          }}
        />
      )}
      {pendingFile && (
        <ImportChoiceDialog
          fileName={pendingFile.name}
          sheets={sheetCount}
          onCancel={() => setPendingFile(null)}
          onChoose={(mode) => {
            void importFromFile(pendingFile, mode);
            setPendingFile(null);
          }}
        />
      )}
    </div>
  );
}
