"use client";

import { useRef, useEffect, useMemo } from "react";
import { Paintbrush } from "lucide-react";
import { selectActiveSelection, selectActiveSheet, useBoundCells, useSelectionAddress, useSheetStore } from "@/store/sheetStore";
import { singleCellSelection } from "@/types/sheet-ui";
import { useT } from "@/i18n";
import { precedentsOf } from "@/lib/precedents";
import { cellRef, rangeRefString } from "@/lib/formulaEngine/address";

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

    /**
   * The ranges the selected formula reads, written out.
   *
   * Ranges as they appear in the formula rather than cell by cell: `=SUM(B2:B50)` reads
   * forty-nine cells and means one range, and the range is the thing worth checking.
   */
  const reads = useMemo(() => {
    const found = precedentsOf(raw);
    const parts = found.ranges.map((r) =>
      r.startRow === r.endRow && r.startCol === r.endCol
        ? cellRef(r.startRow, r.startCol)
        : rangeRefString(r.startRow, r.startCol, r.endRow, r.endCol)
    );
    const loose = [...found.cells].filter(
      (key) => !found.ranges.some((r) => {
        const row = Math.floor(key / 16384);
        const col = key % 16384;
        return row >= r.startRow && row <= r.endRow && col >= r.startCol && col <= r.endCol;
      })
    );
    for (const key of loose.slice(0, 6)) parts.push(cellRef(Math.floor(key / 16384), key % 16384));
    if (parts.length === 0) return "";
    return `${t.formulaBar.reads} ${parts.join(", ")}${found.elsewhere ? ` ${t.formulaBar.readsElsewhere}` : ""}`;
  }, [raw, t.formulaBar]);

  return (
    <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-2 py-1.5 sm:px-4">
      <span className="w-16 shrink-0 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-xs font-medium text-zinc-600">
        {address}
      </span>
      <span className="shrink-0 text-xs italic text-zinc-500">fx</span>
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
      {reads && (
        // The same answer as the amber outline on the grid, in words.
        //
        // A coloured ring tells a sighted person which cells a formula is about and tells a screen
        // reader nothing at all. This is the accessible half, and it turns out to be the more
        // useful one even with a mouse: `C2:C4` and `C2:D4` are easier to tell apart read out than
        // shaded in.
        <span
          className="hidden shrink-0 truncate font-mono text-[11px] text-amber-700 sm:inline"
          title={t.formulaBar.readsTitle}
        >
          {reads}
        </span>
      )}
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
