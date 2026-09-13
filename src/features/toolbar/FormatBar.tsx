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
} from "lucide-react";
import { getComment, NumberFormat } from "@/lib/sheet";
import { isSingleCell } from "@/types/sheet-ui";
import { selectActiveSelection, selectActiveSheet, useAnchorFormat, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import CommentPopover from "@/features/grid/CommentPopover";
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
  const singleCell = isSingleCell(selection);
  const existingComment = getComment(sheet.comments, selection.anchorRow, selection.anchorCol) ?? "";
  const chartOpen = useSheetStore((s) => s.sidebarMode === "chart");
  // Three stacked bars ate a fifth of a 768px laptop screen before a single grid row appeared.
  // Formatting is the least-used of the three, so the whole row folds away — hiding only its
  // contents saved 14px and not one extra row, which is decoration rather than a fix.
  const open = useSheetStore((s) => s.formatBarOpen);
  if (!open) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-zinc-200 bg-white px-2 py-1.5 sm:px-4">
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
        className="h-11 rounded-md border border-zinc-300 px-1.5 text-xs text-zinc-700 outline-none focus:border-emerald-500 sm:h-7"
      >
        {Object.entries(t.numberFormats).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

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
          "flex h-11 items-center gap-1.5 rounded-md border px-2 text-xs font-medium sm:h-7",
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
          "flex h-11 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-medium sm:h-7",
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

      <button
        onClick={() => toggleSidebar("chart")}
        title={t.charts.openTitle}
        className={clsx(
          "flex h-11 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-medium sm:h-7",
          chartOpen ? "border-emerald-600 bg-emerald-700 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        )}
      >
        <BarChart3 size={14} /> <span className="hidden sm:inline">{t.charts.title}</span>
      </button>
      </div>
    </div>
  );
}
