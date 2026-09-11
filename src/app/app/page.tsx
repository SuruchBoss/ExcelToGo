"use client";

import Toolbar from "@/features/toolbar/Toolbar";
import FormatBar from "@/features/toolbar/FormatBar";
import FormulaBar from "@/features/grid/FormulaBar";
import TemplateBar from "@/features/grid/TemplateBar";
import SpreadsheetGrid from "@/features/grid/SpreadsheetGrid";
import SheetTabs from "@/features/grid/SheetTabs";
import FormulaPalette from "@/features/formulas/FormulaPalette";
import FormulaParamPanel from "@/features/formulas/FormulaParamPanel";
import AIAssistantPanel from "@/features/ai/AIAssistantPanel";
import DataSourcePanel from "@/features/data/DataSourcePanel";
import DataPicker from "@/features/data/DataPicker";
import { useLiveDataPolling } from "@/features/data/useLiveDataPolling";
import { useClipboardShortcuts, useHydrateSheetStore, useSheetStore, useUndoRedoShortcuts } from "@/store/sheetStore";
import { useHydrateLocaleStore } from "@/store/localeStore";

export default function Home() {
  useHydrateSheetStore();
  useHydrateLocaleStore();
  useUndoRedoShortcuts();
  useClipboardShortcuts();
  useLiveDataPolling();

  const sidebarMode = useSheetStore((s) => s.sidebarMode);
  const hasPending = useSheetStore((s) => s.pending !== null);
  const sidebarVisible = hasPending || sidebarMode !== "none";

  return (
    <div className="flex h-screen flex-col bg-zinc-50">
      <Toolbar />
      <FormatBar />
      <FormulaBar />
      <TemplateBar />
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="min-h-0 flex-1">
            <SpreadsheetGrid />
          </div>
          <SheetTabs />
        </div>
        {sidebarVisible && (
          <aside className="w-80 shrink-0 rounded-lg border border-zinc-200 bg-white p-3">
            {hasPending ? (
              <FormulaParamPanel />
            ) : sidebarMode === "palette" ? (
              <FormulaPalette />
            ) : sidebarMode === "data" ? (
              <DataSourcePanel />
            ) : (
              <AIAssistantPanel />
            )}
          </aside>
        )}
      </div>
      <DataPicker />
    </div>
  );
}
