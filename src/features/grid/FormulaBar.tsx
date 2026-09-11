"use client";

import { useRef, useEffect } from "react";
import { Paintbrush } from "lucide-react";
import { selectActiveSelection, selectActiveSheet, useBoundCells, useSelectionAddress, useSheetStore } from "@/store/sheetStore";
import { singleCellSelection } from "@/types/sheet-ui";
import { useT } from "@/i18n";

/**
 * Always-visible bar showing the selected cell's address and raw content (a formula or a
 * plain value), editable independently of the grid's own double-click-to-edit overlay — the
 * way Excel's formula bar works. Uses an uncontrolled input keyed by the cell address: moving
 * to a different cell remounts it with that cell's content as the new `defaultValue`, instead
 * of syncing a controlled draft via a ref or effect (both of which this project's lint rules
 * for React 19 reject as unsafe during render).
 */
export default function FormulaBar() {
  const t = useT();
  const selection = useSheetStore(selectActiveSelection);
  const sheet = useSheetStore(selectActiveSheet);
  const setCellRaw = useSheetStore((s) => s.setCellRaw);
  const setSelection = useSheetStore((s) => s.setSelection);
  const address = useSelectionAddress();
  const formatBarOpen = useSheetStore((s) => s.formatBarOpen);
  const toggleFormatBar = useSheetStore((s) => s.toggleFormatBar);

  const raw = sheet.cells[selection.anchorRow]?.[selection.anchorCol] ?? "";
  const inputRef = useRef<HTMLInputElement>(null);
  const bound = useBoundCells().has(`${selection.anchorRow},${selection.anchorCol}`);

  const commit = () => {
    if (bound) return;
    const value = inputRef.current?.value ?? raw;
    if (value !== raw) setCellRaw(selection.anchorRow, selection.anchorCol, value);
  };

  // Clicking a grid cell/header changes `selection` (and thus this input's `key`, remounting
  // it) from the same mousedown that would otherwise blur it — by the time a native blur
  // fires, React may have already re-rendered with the new selection, so `commit` above would
  // read the wrong target cell. Committing on the capture phase runs before that click's own
  // (bubble-phase) handler changes anything, avoiding the race.
  useEffect(() => {
    function handleWindowMouseDown(e: MouseEvent) {
      if (document.activeElement === inputRef.current && e.target !== inputRef.current) commit();
    }
    window.addEventListener("mousedown", handleWindowMouseDown, true);
    return () => window.removeEventListener("mousedown", handleWindowMouseDown, true);
  });

  return (
    <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-1.5">
      <span className="w-16 shrink-0 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-xs font-medium text-zinc-600">
        {address}
      </span>
      <span className="shrink-0 text-xs italic text-zinc-300">fx</span>
      <input
        key={address}
        ref={inputRef}
        defaultValue={raw}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            setSelection(singleCellSelection(Math.min(selection.anchorRow + 1, sheet.rows - 1), selection.anchorCol));
          } else if (e.key === "Escape") {
            if (inputRef.current) inputRef.current.value = raw;
            inputRef.current?.blur();
          }
        }}
        placeholder={t.formulaBar.placeholder}
        readOnly={bound}
        title={bound ? t.data.liveCellReadOnly : undefined}
        className={`flex-1 rounded-md border border-zinc-300 px-2 py-1 font-mono text-sm outline-none focus:border-emerald-500 ${bound ? "bg-emerald-50 text-emerald-800" : ""}`}
      />
      {/* The formatting row's switch lives here because this bar is always present — putting it
          on the row it hides would take the way back with it. */}
      <button
        onClick={toggleFormatBar}
        title={formatBarOpen ? t.formatBar.hide : t.formatBar.show}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
          formatBarOpen ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-zinc-300 text-zinc-500 hover:bg-zinc-50"
        }`}
      >
        <Paintbrush size={14} />
      </button>
    </div>
  );
}
