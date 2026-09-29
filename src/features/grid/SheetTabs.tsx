// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import ShortcutsButton from "@/features/help/ShortcutsButton";
import { usePointingActive } from "./PointingBar";
import clsx from "clsx";
import { isCloudConfigured } from "@/lib/cloud/config";

export default function SheetTabs() {
  const t = useT();
  const sheets = useSheetStore((s) => s.sheets);
  const activeSheetId = useSheetStore((s) => s.activeSheetId);
  const setActiveSheet = useSheetStore((s) => s.setActiveSheet);
  const addSheet = useSheetStore((s) => s.addSheet);
  const renameSheet = useSheetStore((s) => s.renameSheet);
  const deleteSheet = useSheetStore((s) => s.deleteSheet);

  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  // The rule a typed name broke (#54). The editor stays open with it, so the name can be fixed
  // where it was typed rather than lost to a tab that quietly kept its old one.
  const [refusal, setRefusal] = useState<string | null>(null);
  // Out of the way while a formula is pointed at on a phone, like the format row (#99).
  const pointing = usePointingActive();

  const commitRename = () => {
    if (!renaming) return;
    const problem = renameSheet(renaming.id, renaming.name);
    if (problem) {
      setRefusal(t.sheetTabs.nameProblem[problem](renaming.name.trim()));
      return;
    }
    setRefusal(null);
    setRenaming(null);
  };
  const cancelRename = () => {
    setRefusal(null);
    setRenaming(null);
  };

  if (pointing) return null;

  return (
    // On a short screen from 640px wide the panel icons sit at the right end of this row (#129), so
    // the tabs stop short of them: four icons, or five with the cloud one.
    <div
      className={clsx(
        "flex shrink-0 items-center gap-1 overflow-x-auto border-t border-zinc-200 bg-zinc-50 px-2 py-0.5 sm:py-1.5 max-lg:short:min-h-11 max-lg:short:py-0.5",
        isCloudConfigured() ? "sm:max-lg:short:pr-[14.5rem]" : "sm:max-lg:short:pr-[11.75rem]"
      )}
    >
      {sheets.map((tab) => (
        <div
          key={tab.id}
          onClick={() => setActiveSheet(tab.id)}
          onDoubleClick={() => setRenaming({ id: tab.id, name: tab.name })}
          className={clsx(
            "group flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
            tab.id === activeSheetId
              ? "bg-white font-medium text-emerald-700 shadow-sm"
              : "text-zinc-600 hover:bg-zinc-100"
          )}
        >
          {renaming?.id === tab.id ? (
            <>
              <input
                autoFocus
                value={renaming.name}
                aria-label={t.sheetTabs.renameLabel}
                aria-invalid={refusal ? true : undefined}
                aria-describedby={refusal ? "sheet-name-refusal" : undefined}
                onChange={(e) => {
                  setRenaming({ id: tab.id, name: e.target.value });
                  setRefusal(null);
                }}
                onBlur={commitRename}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  else if (e.key === "Escape") cancelRename();
                }}
                className={clsx(
                  "w-24 rounded border px-1 text-sm outline-none",
                  refusal ? "border-red-500" : "border-emerald-400"
                )}
              />
              {refusal && (
                <span id="sheet-name-refusal" role="alert" className="max-w-xs whitespace-normal text-xs text-red-700">
                  {refusal}
                </span>
              )}
            </>
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
              // Same reason as the column filter: on a touch screen nothing hovers, so this was an
              // invisible button and deleting a sheet was a feature you had to already know about.
              className="rounded p-1.5 text-zinc-300 opacity-0 hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={addSheet}
        title={t.sheetTabs.addTitle}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 sm:h-7 sm:w-7"
      >
        <Plus size={16} />
      </button>
      <ShortcutsButton />
    </div>
  );
}
