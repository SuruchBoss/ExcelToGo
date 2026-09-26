// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useState } from "react";
import {
  Bold,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowDownAZ,
  ArrowDownZA,
  BarChart3,
  MessageSquareText,
  Palette,
  ShieldCheck,
  Snowflake,
  Tag,
  Table2,
  TableCellsMerge,
} from "lucide-react";
import { getComment, NumberFormat } from "@/lib/sheet";
import { isSingleCell } from "@/types/sheet-ui";
import { mergeWouldDiscard, rangeHasMerge } from "@/lib/sheetMerges";
import { isFrozen } from "@/lib/sheetFreeze";
import { ruleAt } from "@/lib/dataValidation";
import { selectActiveSelection, selectActiveSheet, useAnchorFormat, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import CommentPopover from "@/features/grid/CommentPopover";
import ValidationPopover from "@/features/grid/ValidationPopover";
import NamesPopover from "@/features/grid/NamesPopover";
import clsx from "clsx";

export default function FormatBar() {
  const t = useT();
  const format = useAnchorFormat();
  const toggleBold = useSheetStore((s) => s.toggleBold);
  const setAlign = useSheetStore((s) => s.setAlign);
  const setTextColor = useSheetStore((s) => s.setTextColor);
  const setNumberFormat = useSheetStore((s) => s.setNumberFormat);
  const sortSelection = useSheetStore((s) => s.sortSelection);
  const toggleSidebar = useSheetStore((s) => s.toggleSidebar);
  const cfOpen = useSheetStore((s) => s.sidebarMode === "cf");
  const sheet = useSheetStore(selectActiveSheet);
  const selection = useSheetStore(selectActiveSelection);
  const setCellComment = useSheetStore((s) => s.setCellComment);
  const [commentAt, setCommentAt] = useState<{ x: number; y: number } | null>(null);
  const [validationAt, setValidationAt] = useState<{ x: number; y: number } | null>(null);
  const [namesAt, setNamesAt] = useState<{ x: number; y: number } | null>(null);
  const singleCell = isSingleCell(selection);
  // Whether the button currently splits rather than joins.
  const merging = rangeHasMerge(sheet.merges, {
    startRow: selection.startRow,
    startCol: selection.startCol,
    endRow: selection.endRow,
    endCol: selection.endCol,
  });
  const existingComment = getComment(sheet.comments, selection.anchorRow, selection.anchorCol) ?? "";
  const anchorRule = ruleAt(sheet, selection.anchorRow, selection.anchorCol);
  const chartOpen = useSheetStore((s) => s.sidebarMode === "chart");
  const pivotOpen = useSheetStore((s) => s.sidebarMode === "pivot");
  const toggleMerge = useSheetStore((s) => s.toggleMerge);
  const toggleFreeze = useSheetStore((s) => s.toggleFreeze);
  const frozen = isFrozen(sheet.freeze);
  // Three stacked bars ate a fifth of a 768px laptop screen before a single grid row appeared.
  // Formatting is the least-used of the three, so the whole row folds away — hiding only its
  // contents saved 14px and not one extra row, which is decoration rather than a fix.
  const open = useSheetStore((s) => s.formatBarOpen);
  if (!open) return null;

  return (
    <div className="flex items-center gap-2 scroll-hint-x overflow-x-auto border-b border-zinc-200 bg-white px-2 py-1.5 sm:px-4">
      <span className="hidden shrink-0 text-xs font-medium text-zinc-500 sm:inline">{t.formatBar.label}</span>
      <div className="flex shrink-0 items-center gap-2">

      <button
        onClick={toggleBold}
        title={t.formatBar.boldTitle}
        className={clsx(
          "flex h-11 w-11 items-center justify-center rounded-md border sm:h-7 sm:w-7",
          format.bold ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
        )}
      >
        <Bold size={14} />
      </button>

      <div className="flex overflow-hidden rounded-md border border-zinc-300">
        {(
          [
            { v: "left", Icon: AlignLeft },
            { v: "center", Icon: AlignCenter },
            { v: "right", Icon: AlignRight },
          ] as const
        ).map(({ v, Icon }) => (
          <button
            key={v}
            onClick={() => setAlign(v)}
            title={t.formatBar.alignTitle[v]}
            className={clsx(
              "flex h-11 w-11 items-center justify-center border-r border-zinc-300 last:border-r-0 sm:h-7 sm:w-7",
              (format.align ?? "left") === v ? "bg-emerald-50 text-emerald-700" : "text-zinc-600 hover:bg-zinc-50"
            )}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      <label title={t.formatBar.colorTitle} className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50 sm:h-7 sm:w-7">
        <span className="text-xs font-bold" style={{ color: format.color ?? "#18181b" }}>
          A
        </span>
        <input
          type="color"
          value={format.color ?? "#18181b"}
          onChange={(e) => setTextColor(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>

      <select
        value={format.numberFormat ?? "general"}
        onChange={(e) => setNumberFormat(e.target.value as NumberFormat)}
        aria-label={t.formatBar.numberFormatTitle}
        title={t.formatBar.numberFormatTitle}
        className="h-11 rounded-md border border-zinc-300 px-1.5 text-xs text-zinc-700 outline-none focus:border-emerald-500 sm:h-7"
      >
        {Object.entries(t.numberFormats).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {/* One button, two directions: a selection touching a merge splits it, one that doesn't joins
          it. Splitting is free, so only joining asks — and only when a cell that isn't the top-left
          actually holds something, since a confirm dialog over an empty range is a dialog that
          teaches people to click through dialogs. */}
      <button
        onClick={() => {
          const range = {
            startRow: selection.startRow,
            startCol: selection.startCol,
            endRow: selection.endRow,
            endCol: selection.endCol,
          };
          const splitting = rangeHasMerge(sheet.merges, range);
          if (!splitting && mergeWouldDiscard(sheet.cells, sheet.merges, range) && !confirm(t.merge.confirmDiscard)) {
            return;
          }
          toggleMerge();
        }}
        disabled={!merging && singleCell}
        aria-label={merging ? t.merge.split : t.merge.join}
        title={merging ? t.merge.split : t.merge.title}
        className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400 sm:h-7 sm:min-w-0 sm:justify-start"
      >
        <TableCellsMerge size={14} />{" "}
        <span className="hidden sm:inline">{merging ? t.merge.split : t.merge.join}</span>
      </button>

      <button
        onClick={toggleFreeze}
        // Disabled at A1 because there is nothing above or to the left of it to freeze, and a
        // button that looks live and does nothing is worse than one that says it cannot.
        disabled={!frozen && selection.anchorRow === 0 && selection.anchorCol === 0}
        aria-label={frozen ? t.freeze.unfreeze : t.freeze.freeze}
        title={frozen ? t.freeze.unfreeze : t.freeze.title}
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400 sm:h-7 sm:min-w-0 sm:justify-start",
          frozen ? "border-blue-400 bg-blue-50 text-blue-800" : "border-zinc-300 text-zinc-700"
        )}
      >
        <Snowflake size={14} />{" "}
        <span className="hidden sm:inline">{frozen ? t.freeze.unfreeze : t.freeze.freeze}</span>
      </button>

      <div className="mx-1 h-5 w-px bg-zinc-200" />

      <button
        onClick={() => sortSelection(true)}
        title={t.formatBar.sortAscTitle}
        className="flex h-11 w-11 items-center justify-center rounded-md border sm:h-7 sm:w-7 border-zinc-300 text-zinc-600 hover:bg-zinc-50"
      >
        <ArrowDownAZ size={14} />
      </button>
      <button
        onClick={() => sortSelection(false)}
        title={t.formatBar.sortDescTitle}
        className="flex h-11 w-11 items-center justify-center rounded-md border sm:h-7 sm:w-7 border-zinc-300 text-zinc-600 hover:bg-zinc-50"
      >
        <ArrowDownZA size={14} />
      </button>

      <div className="mx-1 h-5 w-px bg-zinc-200" />

      {/* Lives here rather than in the top toolbar: this is formatting, and the toolbar's four
          buttons were already the widest row on a small laptop. */}
      <button
        onClick={() => toggleSidebar("cf")}
        title={t.conditionalFormat.openTitle}
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium sm:h-7 sm:min-w-0 sm:justify-start",
          cfOpen ? "border-emerald-600 bg-emerald-700 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        )}
      >
        <Palette size={14} /> <span className="hidden sm:inline">{t.conditionalFormat.title}</span>
      </button>

      {/* A single cell, because a note is about one cell: pointing it at a block would have to
          either fan out into a note per cell or invent a note about a rectangle. */}
      <button
        onClick={(e) => {
          if (!singleCell) return;
          // The popover dismisses itself on any click reaching the window, and this very click is
          // still on its way there — without this it opens and closes in the same gesture.
          e.stopPropagation();
          const box = e.currentTarget.getBoundingClientRect();
          setCommentAt({ x: Math.min(box.left, window.innerWidth - 300), y: box.bottom + 6 });
        }}
        disabled={!singleCell}
        title={singleCell ? t.comments.openTitle : t.comments.selectCell}
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium sm:h-7 sm:min-w-0 sm:justify-start",
          !singleCell
            ? "cursor-not-allowed border-zinc-200 text-zinc-300"
            : existingComment
              ? "border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-100"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        )}
      >
        <MessageSquareText size={14} /> <span className="hidden sm:inline">{t.comments.title}</span>
      </button>

      {commentAt && (
        <CommentPopover
          row={selection.anchorRow}
          col={selection.anchorCol}
          value={existingComment}
          anchor={commentAt}
          onSave={(text) => setCellComment(selection.anchorRow, selection.anchorCol, text)}
          onClose={() => setCommentAt(null)}
        />
      )}

      {/* A rectangle, not a single cell: a dropdown is something you put on a column, and a
          feature that could only do one cell at a time would be set up one cell at a time. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          const box = e.currentTarget.getBoundingClientRect();
          setValidationAt({ x: Math.min(box.left, window.innerWidth - 332), y: box.bottom + 6 });
        }}
        title={t.validation.openTitle}
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium sm:h-7 sm:min-w-0 sm:justify-start",
          anchorRule
            ? "border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        )}
      >
        <ShieldCheck size={14} /> <span className="hidden sm:inline">{t.validation.short}</span>
      </button>

      {validationAt && <ValidationPopover anchor={validationAt} onClose={() => setValidationAt(null)} />}

      <button
        onClick={(e) => {
          e.stopPropagation();
          const box = e.currentTarget.getBoundingClientRect();
          setNamesAt({ x: Math.min(box.left, window.innerWidth - 332), y: box.bottom + 6 });
        }}
        title={t.names.openTitle}
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium sm:h-7 sm:min-w-0 sm:justify-start",
          sheet.names
            ? "border-sky-500 bg-sky-50 text-sky-800 hover:bg-sky-100"
            : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        )}
      >
        <Tag size={14} /> <span className="hidden sm:inline">{t.names.short}</span>
      </button>

      {namesAt && <NamesPopover anchor={namesAt} onClose={() => setNamesAt(null)} />}

      <button
        onClick={() => toggleSidebar("chart")}
        title={t.charts.openTitle}
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium sm:h-7 sm:min-w-0 sm:justify-start",
          chartOpen ? "border-emerald-600 bg-emerald-700 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        )}
      >
        <BarChart3 size={14} /> <span className="hidden sm:inline">{t.charts.title}</span>
      </button>



      <button
        onClick={() => toggleSidebar("pivot")}
        title={t.pivot.title}
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium sm:h-7 sm:min-w-0 sm:justify-start",
          pivotOpen ? "border-emerald-600 bg-emerald-700 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        )}
      >
        <Table2 size={14} /> <span className="hidden sm:inline">{t.pivot.title}</span>
      </button>
      </div>
    </div>
  );
}
