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
import ConditionalFormatPanel from "@/features/grid/ConditionalFormatPanel";
import ChartPanel from "@/features/grid/ChartPanel";
import StorageNotice from "@/features/grid/StorageNotice";
import DataPicker from "@/features/data/DataPicker";
import { X } from "lucide-react";
import { useLiveDataPolling } from "@/features/data/useLiveDataPolling";
import { useClipboardShortcuts, useHydrateSheetStore, useSheetStore, useUndoRedoShortcuts } from "@/store/sheetStore";
import { useHydrateLocaleStore } from "@/store/localeStore";
import { useT } from "@/i18n";
import { useEffect } from "react";

export default function Home() {
  const t = useT();
  useHydrateSheetStore();
  useHydrateLocaleStore();
  useUndoRedoShortcuts();
  useClipboardShortcuts();
  useLiveDataPolling();

  // The panel covers the whole screen on a phone, so leaving it open by default meant a visitor
  // arriving from a phone saw the formula list and not one cell of the spreadsheet. Closing it on
  // a narrow screen is a store action rather than React state, so it costs no extra render.
  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      useSheetStore.getState().setSidebarMode("none");
    }
  }, []);

  const sidebarMode = useSheetStore((s) => s.sidebarMode);
  const hasPending = useSheetStore((s) => s.pending !== null);
  const setSidebarMode = useSheetStore((s) => s.setSidebarMode);
  const cancelPending = useSheetStore((s) => s.cancelPending);
  const sidebarVisible = hasPending || sidebarMode !== "none";
  const closeSidebar = () => (hasPending ? cancelPending() : setSidebarMode("none"));

  return (
    <div className="flex h-screen flex-col bg-zinc-50">
      <Toolbar />
      <FormatBar />
      <FormulaBar />
      <TemplateBar />
      <StorageNotice />
      <div className="flex min-h-0 flex-1 gap-3 p-2 sm:p-3">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="min-h-0 flex-1">
            <SpreadsheetGrid />
          </div>
          <SheetTabs />
        </div>
        {sidebarVisible && (
          <>
            {/* On a phone the panel covers the screen instead of sitting beside the grid. Side by
                side, a 320px panel left the grid showing nothing but its row numbers — the one
                thing a spreadsheet must never hide. */}
            <div
              onClick={closeSidebar}
              aria-hidden
              className="fixed inset-0 z-30 bg-zinc-900/30 lg:hidden"
            />
            <aside className="fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white p-3 shadow-2xl lg:static lg:inset-auto lg:z-auto lg:w-80 lg:shrink-0 lg:rounded-lg lg:shadow-none">
              <button
                onClick={closeSidebar}
                className="mb-2 flex min-h-11 items-center justify-center gap-1.5 self-end rounded-md px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 lg:hidden"
              >
                <X size={16} /> {t.app.close}
              </button>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {hasPending ? (
                  <FormulaParamPanel />
                ) : sidebarMode === "palette" ? (
                  <FormulaPalette />
                ) : sidebarMode === "data" ? (
                  <DataSourcePanel />
                ) : sidebarMode === "cf" ? (
                  <ConditionalFormatPanel />
                ) : sidebarMode === "chart" ? (
                  <ChartPanel />
                ) : (
                  <AIAssistantPanel />
                )}
              </div>
            </aside>
          </>
        )}
      </div>
      <DataPicker />
    </div>
  );
}
