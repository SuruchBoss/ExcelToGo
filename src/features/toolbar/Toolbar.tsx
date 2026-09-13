"use client";

import { useRef } from "react";
import { FileUp, FileDown, FileText, Plus, Sparkles, Sigma, Undo2, Redo2, Save, Database, Cloud } from "lucide-react";
import { useCanRedo, useCanUndo, redoSheet, undoSheet, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import LanguageToggle from "./LanguageToggle";
import Link from "next/link";
import { DEMO_MODE } from "@/lib/demoMode";
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
    <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 bg-white px-2 py-1.5 sm:gap-2 sm:px-4 sm:py-2">
      {/* The brand doubles as the way back to the landing page, the way it does on most sites. */}
      <Link href="/" title={t.landing.home} className="mr-2 text-lg font-bold text-emerald-700 hover:text-emerald-800">
        {t.app.brand}
      </Link>

      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5"
      >
        <FileUp size={15} /> <span className="hidden sm:inline">{t.toolbar.importExcel}</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importFromFile(file);
          e.target.value = "";
        }}
      />

      <button
        onClick={exportXlsx}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5"
      >
        <FileDown size={15} /> <span className="hidden sm:inline">{t.toolbar.exportExcel}</span>
      </button>

      <button
        onClick={exportPdf}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5"
      >
        <FileText size={15} /> <span className="hidden sm:inline">{t.toolbar.exportPdf}</span>
      </button>

      <div className="mx-1 h-5 w-px bg-zinc-200" />

      <button
        onClick={undoSheet}
        disabled={!canUndo}
        title={t.toolbar.undoTitle}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Undo2 size={15} />
      </button>
      <button
        onClick={redoSheet}
        disabled={!canRedo}
        title={t.toolbar.redoTitle}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Redo2 size={15} />
      </button>

      <div className="mx-1 h-5 w-px bg-zinc-200" />

      <button
        onClick={addRow}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:py-1.5"
      >
        <Plus size={14} /> <span className="hidden sm:inline">{t.toolbar.addRow}</span>
      </button>
      <button
        onClick={addColumn}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:min-w-0 sm:justify-start sm:py-1.5"
      >
        <Plus size={14} /> <span className="hidden sm:inline">{t.toolbar.addColumn}</span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        {busy ? (
          <span className="text-xs text-zinc-500">{busy}</span>
        ) : (
          <span title={t.toolbar.autosaveTitle} className="hidden items-center gap-1 text-xs text-zinc-500 sm:flex">
            <Save size={13} /> {t.toolbar.autosaveLabel}
          </span>
        )}
        <button
          onClick={() => toggleSidebar("palette")}
          className={`flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5 ${
            paletteOpen ? "bg-emerald-700 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <Sigma size={15} /> <span className="hidden sm:inline">{t.toolbar.formulas}</span>
        </button>
        <button
          onClick={() => toggleSidebar("ai")}
          className={`flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5 ${
            aiOpen ? "bg-emerald-700 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <Sparkles size={15} /> <span className="hidden sm:inline">{t.toolbar.askAi}</span>
        </button>
        {/* Hidden rather than disabled on a public demo: the feature is off server-side too, so a
            button that could only fail is worse than no button. See src/lib/demoMode.ts. */}
        {!DEMO_MODE && (
          <button
            onClick={() => toggleSidebar("data")}
            className={`flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5 ${
              dataOpen ? "bg-emerald-700 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            <Database size={15} /> <span className="hidden sm:inline">{t.toolbar.data}</span>
          </button>
        )}
        {/* Absent, not disabled, when no cloud backend is configured — which is the default. The
            app is open source, not a hosted service: you point it at your own Supabase project or
            you get the same browser-only app as before. See src/lib/cloud/config.ts. */}
        {isCloudConfigured() && (
          <button
            onClick={() => toggleSidebar("cloud")}
            className={`flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5 ${
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
