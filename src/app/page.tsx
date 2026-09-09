"use client";

import Toolbar from "@/features/toolbar/Toolbar";
import SpreadsheetGrid from "@/features/grid/SpreadsheetGrid";
import FormulaPalette from "@/features/formulas/FormulaPalette";
import FormulaParamPanel from "@/features/formulas/FormulaParamPanel";
import AIAssistantPanel from "@/features/ai/AIAssistantPanel";
import { useSheetStore } from "@/store/sheetStore";

export default function Home() {
  const sidebarMode = useSheetStore((s) => s.sidebarMode);
  const hasPending = useSheetStore((s) => s.pending !== null);
  const sidebarVisible = hasPending || sidebarMode !== "none";

  return (
    <div className="flex h-screen flex-col bg-zinc-50">
      <Toolbar />
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <div className="min-w-0 flex-1">
          <SpreadsheetGrid />
        </div>
        {sidebarVisible && (
          <aside className="w-80 shrink-0 rounded-lg border border-zinc-200 bg-white p-3">
            {hasPending ? <FormulaParamPanel /> : sidebarMode === "palette" ? <FormulaPalette /> : <AIAssistantPanel />}
          </aside>
        )}
      </div>
    </div>
  );
}
