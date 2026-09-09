"use client";

import { useRef } from "react";
import { FileUp, FileDown, FileText, Plus, Sparkles, Sigma } from "lucide-react";
import { useSheetStore } from "@/store/sheetStore";

export default function Toolbar() {
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

  const paletteOpen = sidebarMode === "palette" && !hasPending;
  const aiOpen = sidebarMode === "ai" && !hasPending;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2">
      <span className="mr-2 text-lg font-bold text-blue-700">ExcelToGo</span>

      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        <FileUp size={15} /> นำเข้า Excel
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
        className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        <FileDown size={15} /> ส่งออก Excel
      </button>

      <button
        onClick={exportPdf}
        className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        <FileText size={15} /> ส่งออก PDF
      </button>

      <div className="mx-1 h-5 w-px bg-zinc-200" />

      <button
        onClick={addRow}
        className="flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        <Plus size={14} /> แถว
      </button>
      <button
        onClick={addColumn}
        className="flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        <Plus size={14} /> คอลัมน์
      </button>

      <div className="ml-auto flex items-center gap-2">
        {busy && <span className="text-xs text-zinc-400">{busy}</span>}
        <button
          onClick={() => toggleSidebar("palette")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
            paletteOpen ? "bg-blue-600 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <Sigma size={15} /> สูตร
        </button>
        <button
          onClick={() => toggleSidebar("ai")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
            aiOpen ? "bg-violet-600 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <Sparkles size={15} /> ถาม AI
        </button>
      </div>
    </div>
  );
}
