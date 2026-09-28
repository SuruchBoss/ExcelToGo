// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import Toolbar from "@/features/toolbar/Toolbar";
import FormatBar from "@/features/toolbar/FormatBar";
import FormulaBar from "@/features/grid/FormulaBar";
import TemplateBar from "@/features/grid/TemplateBar";
import SpreadsheetGrid from "@/features/grid/SpreadsheetGrid";
import BackToSelection from "@/features/grid/BackToSelection";
import SheetTabs from "@/features/grid/SheetTabs";
import TouchActionBar from "@/features/grid/TouchActionBar";
import FormulaPalette from "@/features/formulas/FormulaPalette";
import FormulaParamPanel from "@/features/formulas/FormulaParamPanel";
import AIAssistantPanel from "@/features/ai/AIAssistantPanel";
import DataSourcePanel from "@/features/data/DataSourcePanel";
import ConditionalFormatPanel from "@/features/grid/ConditionalFormatPanel";
import ChartPanel from "@/features/grid/ChartPanel";
import PivotPanel from "@/features/grid/PivotPanel";
import CloudPanel from "@/features/cloud/CloudPanel";
import StorageNotice from "@/features/grid/StorageNotice";
import SaveFailedNotice from "@/features/grid/SaveFailedNotice";
import SampleNotice from "@/features/grid/SampleNotice";
import StartNotice from "@/features/grid/StartNotice";
import PivotNotice from "@/features/grid/PivotNotice";
import ImportNotice from "@/features/grid/ImportNotice";
import DataPicker from "@/features/data/DataPicker";
import LiveAnnouncer from "@/features/a11y/LiveAnnouncer";
import FindPanel from "@/features/search/FindPanel";
import { useFindDialog } from "@/features/search/useFindDialog";
import SkipLink from "@/features/a11y/SkipLink";
import { X } from "lucide-react";
import { useLiveDataPolling } from "@/features/data/useLiveDataPolling";
import {
  selectHasWork,
  selectShowingSample,
  useClipboardShortcuts,
  useHydrateSheetStore,
  useSampleFollowsLocale,
  useSheetStore,
  useUndoRedoShortcuts,
} from "@/store/sheetStore";
import { useServiceWorker } from "@/features/offline/useServiceWorker";
import { useHydrateLocaleStore } from "@/store/localeStore";
import { useT } from "@/i18n";
import { countUsage } from "@/lib/usage";
import { useEffect, useSyncExternalStore } from "react";

/** "Has this rendered in a browser yet?" — false on the server and during hydration, true after. */
const noSubscription = () => () => {};

export default function Home() {
  const t = useT();
  useHydrateSheetStore();
  useServiceWorker();
  useHydrateLocaleStore();
  useSampleFollowsLocale();
  useUndoRedoShortcuts();
  useClipboardShortcuts();
  useLiveDataPolling();
  const showingSample = useSheetStore(selectShowingSample);
  const hasWork = useSheetStore(selectHasWork);

  // The panel covers the whole screen on a phone, so leaving it open by default meant a visitor
  // arriving from a phone saw the formula list and not one cell of the spreadsheet. Closing it on
  // a narrow screen is a store action rather than React state, so it costs no extra render.
  //
  // But the store's default is the open palette, and that is what the server renders — so on a slow
  // connection a phone showed the panel over the whole screen for two to nine seconds before this
  // effect ran and took it away (blind test U32). Until then the panel is hidden below 1024px by
  // CSS, which needs no JavaScript to apply.
  const mounted = useSyncExternalStore(noSubscription, () => true, () => false);
  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      useSheetStore.getState().setSidebarMode("none");
    }
    // The only count that is a page load rather than an act. Does nothing at all unless this
    // deployment set NEXT_PUBLIC_USAGE=1 — see lib/usage.ts for the whole of what it may send.
    countUsage("app_opened");
  }, []);

  const find = useFindDialog();
  const sidebarMode = useSheetStore((s) => s.sidebarMode);
  const hasPending = useSheetStore((s) => s.pending !== null);
  const setSidebarMode = useSheetStore((s) => s.setSidebarMode);
  const cancelPending = useSheetStore((s) => s.cancelPending);
  const sidebarVisible = hasPending || sidebarMode !== "none";
  const closeSidebar = () => (hasPending ? cancelPending() : setSidebarMode("none"));

  return (
    // `dvh`, not `vh`: on a phone 100vh is the height with the browser's address bar hidden, so the
    // sheet tabs sat under the bar whenever it was showing. The bottom padding is the tab bar's
    // height — below 1024px the panel switches are pinned there (see Toolbar).
    <div className="flex h-dvh flex-col bg-zinc-50 max-lg:pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      <SkipLink />
      <LiveAnnouncer />
      {find.open && <FindPanel onClose={find.close} />}
      <Toolbar />
      <FormatBar />
      <FormulaBar />
      <TemplateBar />
      <SaveFailedNotice />
      {showingSample ? <SampleNotice /> : hasWork ? <StorageNotice /> : <StartNotice />}
      <ImportNotice />
      <PivotNotice />
      <div className="flex min-h-0 flex-1 gap-3 p-2 sm:p-3">
        <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white outline-none">
          <div className="relative min-h-0 flex-1">
            <SpreadsheetGrid />
            <BackToSelection />
          </div>
          <TouchActionBar />
          <SheetTabs />
        </main>
        {sidebarVisible && (
          <>
            {/* On a phone the panel is a sheet instead of sitting beside the grid. Side by side, a
                320px panel left the grid showing nothing but its row numbers — the one thing a
                spreadsheet must never hide. Below 1024px the sheet stops short of the top, so the
                first rows and the selected cell stay in view while a formula is chosen for it,
                and it stops above the tab bar, so another panel is one press away. */}
            <div
              onClick={closeSidebar}
              aria-hidden
              className={`fixed inset-0 z-30 bg-zinc-900/30 lg:hidden ${mounted ? "" : "hidden"}`}
            />
            <aside className={`${mounted ? "" : "max-lg:hidden"} fixed inset-x-0 bottom-0 top-14 z-40 max-lg:top-[30dvh] max-lg:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] flex flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white p-3 shadow-2xl lg:static lg:inset-auto lg:z-auto lg:w-80 lg:shrink-0 lg:rounded-lg lg:shadow-none`}>
              <button
                onClick={closeSidebar}
                className="-mt-1 mb-1 flex min-h-10 items-center justify-center gap-1.5 self-end rounded-md px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 lg:hidden"
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
                ) : sidebarMode === "pivot" ? (
                  <PivotPanel />
                ) : sidebarMode === "cloud" ? (
                  <CloudPanel />
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
