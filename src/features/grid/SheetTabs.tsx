"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import clsx from "clsx";

export default function SheetTabs() {
  const t = useT();
  const sheets = useSheetStore((s) => s.sheets);
  const activeSheetId = useSheetStore((s) => s.activeSheetId);
  const setActiveSheet = useSheetStore((s) => s.setActiveSheet);
  const addSheet = useSheetStore((s) => s.addSheet);
  const renameSheet = useSheetStore((s) => s.renameSheet);
  const deleteSheet = useSheetStore((s) => s.deleteSheet);

  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const commitRename = () => {
    if (renaming) renameSheet(renaming.id, renaming.name);
    setRenaming(null);
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-t border-zinc-200 bg-zinc-50 px-2 py-1.5">
      {sheets.map((tab) => (
        <div
          key={tab.id}
          onClick={() => setActiveSheet(tab.id)}
          onDoubleClick={() => setRenaming({ id: tab.id, name: tab.name })}
          className={clsx(
            "group flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
            tab.id === activeSheetId
              ? "bg-white font-medium text-blue-700 shadow-sm"
              : "text-zinc-600 hover:bg-zinc-100"
          )}
        >
          {renaming?.id === tab.id ? (
            <input
              autoFocus
              value={renaming.name}
              onChange={(e) => setRenaming({ id: tab.id, name: e.target.value })}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                else if (e.key === "Escape") setRenaming(null);
              }}
              className="w-24 rounded border border-blue-400 px-1 text-sm outline-none"
            />
          ) : (
            <span className="cursor-pointer select-none">{tab.name}</span>
          )}
          {sheets.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(t.sheetTabs.confirmDelete(tab.name))) deleteSheet(tab.id);
              }}
              title={t.sheetTabs.deleteTitle}
              className="rounded p-0.5 text-zinc-300 opacity-0 hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={addSheet}
        title={t.sheetTabs.addTitle}
        className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
