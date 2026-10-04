// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { Paintbrush } from "lucide-react";
import {
  selectActiveNames,
  selectActiveSelection,
  selectActiveSheet,
  useBoundCells,
  useSelectionAddress,
  useSheetStore,
} from "@/store/sheetStore";
import { useTabStore } from "@/store/tabStore";
import { singleCellSelection } from "@/types/sheet-ui";
import { useT } from "@/i18n";
import { precedentsOf } from "@/lib/precedents";
import { cellRef, rangeRefString } from "@/lib/formulaEngine/address";
import { FormulaBarDraft, formulaBarCellKey, formulaBarShown, formulaBarWrite } from "./formulaBarDraft";
import { awaitsOperand } from "./openFormula";
import { lastPressWasTouch, noteFormulaText, pointingFormula, registerFormulaEditor, unregisterFormulaEditor, usePointingStore } from "./pointing";

/**
 * Always-visible bar showing the selected cell's address and raw content (a formula or a
 * plain value), editable independently of the grid's own double-click-to-edit overlay — the
 * way Excel's formula bar works.
 *
 * Controlled, and showing the cell as it is *now* unless somebody has typed into the bar. It used
 * to be an uncontrolled input keyed by address, holding its own copy of the content from when it
 * was shown: a sort, a Delete or an undo changed the cell under the same address, the bar kept the
 * old copy, and focusing it then leaving wrote that copy back (#42). Now there is no copy until a
 * key is pressed (`formulaBarDraft.ts`), so leaving without typing writes nothing. Not remounted
 * when the content changes either — a remount mid-composition drops what a Thai input method has
 * not committed yet.
 */
export default function FormulaBar() {
  const t = useT();
  const selection = useSheetStore(selectActiveSelection);
  const sheet = useSheetStore(selectActiveSheet);
  const names = useSheetStore(selectActiveNames);
  const setCellRaw = useSheetStore((s) => s.setCellRaw);
  const setSelection = useSheetStore((s) => s.setSelection);
  const address = useSelectionAddress();
  const formatBarOpen = useSheetStore((s) => s.formatBarOpen);
  const toggleFormatBar = useSheetStore((s) => s.toggleFormatBar);

  const activeSheetId = useSheetStore((s) => s.activeSheetId);
  const raw = sheet.cells[selection.anchorRow]?.[selection.anchorCol] ?? "";
  const inputRef = useRef<HTMLInputElement>(null);
  const bound = useBoundCells().has(`${selection.anchorRow},${selection.anchorCol}`);
  // A tab that is only looking (#47): the bar still shows the formula, it just cannot change it.
  const looking = useTabStore((s) => s.role === "asking" || s.role === "viewer" || s.role === "handedOff");
  const cellKey = formulaBarCellKey(activeSheetId, selection.anchorRow, selection.anchorCol);
  const [draft, setDraft] = useState<FormulaBarDraft | null>(null);
  // The same draft, readable synchronously: a click elsewhere commits from the window's mousedown
  // and then again from the input's own blur, and the second call may still hold the first one's
  // closure. Clearing this on the first commit is what makes the second write nothing.
  const draftRef = useRef<FormulaBarDraft | null>(null);
  // What the cell's own editor holds while it is open, as Excel's bar shows it. The bar used to
  // show the cell as saved — empty, so its placeholder — while `=SUM(` was typed in the cell, and
  // the cell's editor is too narrow to hold a formula (PO's check of #142 at 390px). Shown only:
  // focusing the bar closes the cell's editor first, and what the bar writes is its own draft.
  const cellEditing = usePointingStore((s) => (s.editor?.input.closest("td") ? s.text : null));

  const commit = () => {
    const pending = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    const value = bound ? null : formulaBarWrite(pending, cellKey, raw);
    if (value !== null) setCellRaw(selection.anchorRow, selection.anchorCol, value);
  };

  // Clicking a grid cell/header changes `selection` from the same mousedown that would otherwise
  // blur the bar — by the time a native blur fires, React may have already re-rendered with the
  // new selection, so `commit` above would read the wrong target cell. Committing on the capture
  // phase runs before that click's own (bubble-phase) handler changes anything, avoiding the race.
  useEffect(() => {
    function handleWindowMouseDown(e: MouseEvent) {
      if (document.activeElement !== inputRef.current || e.target === inputRef.current) return;
      // A finger on the grid while a formula is open is pointing, not leaving: the grid puts the
      // cell's address into this bar and the bar keeps its draft (#99).
      if (pointingFormula() && lastPressWasTouch() && (e.target as HTMLElement).closest?.('[role="grid"]')) return;
      // `=` typed here and then a tap on a cell saved `=` over the selected cell and moved on — on
      // the sample sheet it wrote over "Mains" (#99). While the formula is still waiting for an
      // address the grid ignores the tap and the bar keeps its draft and its keyboard.
      if (awaitsOperand(draftRef.current?.text) && (e.target as HTMLElement).closest?.('[role="grid"]')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      commit();
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
    const found = precedentsOf(raw, undefined, names);
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
  }, [raw, names, t.formulaBar]);

  return (
    <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-2 py-1.5 sm:px-4 max-lg:short:py-1 sm:max-lg:short:border-b-0 sm:max-lg:short:pl-0">
      <span className="w-16 shrink-0 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-xs font-medium text-zinc-600">
        {address}
      </span>
      <span className="shrink-0 text-xs italic text-zinc-500">fx</span>
      <input
        ref={inputRef}
        value={cellEditing ?? formulaBarShown(draft, cellKey, raw)}
        onChange={(e) => {
          draftRef.current = { cellKey, text: e.target.value };
          setDraft(draftRef.current);
          noteFormulaText(e.currentTarget, e.target.value);
        }}
        onFocus={(e) =>
          registerFormulaEditor({
            input: e.currentTarget,
            commit: (text) => {
              draftRef.current = { cellKey, text };
              commit();
              inputRef.current?.blur();
            },
            cancel: () => {
              draftRef.current = null;
              setDraft(null);
              inputRef.current?.blur();
            },
          })
        }
        onBlur={(e) => {
          unregisterFormulaEditor(e.currentTarget);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            // Back to the grid, as Excel's Enter does (#201). Kept focused, the bar went on showing
            // the next cell's formula as if it were being edited: a tap then pointed into it, and
            // typing went on the end of it. With the bar blurred, the grid takes focus onto the
            // cell the cursor moves to, so the arrow keys carry on from there.
            inputRef.current?.blur();
            setSelection(singleCellSelection(Math.min(selection.anchorRow + 1, sheet.rows - 1), selection.anchorCol));
          } else if (e.key === "Escape") {
            draftRef.current = null;
            setDraft(null);
            inputRef.current?.blur();
          }
        }}
        placeholder={t.formulaBar.placeholder}
        readOnly={bound || looking}
        title={bound ? t.data.liveCellReadOnly : undefined}
        className={`min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1 font-mono text-sm outline-none focus:border-emerald-500 ${bound ? "bg-emerald-50 text-emerald-800" : ""}`}
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
        aria-label={t.formatBar.toggle}
        aria-pressed={formatBarOpen}
        title={t.formatBar.toggle}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
          formatBarOpen ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-zinc-300 text-zinc-500 hover:bg-zinc-50"
        }`}
      >
        <Paintbrush size={14} />
      </button>
    </div>
  );
}
