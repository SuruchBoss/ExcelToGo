// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowDownAZ,
  ArrowDownZA,
  BarChart3,
  CalendarCheck,
  MessageSquareText,
  Palette,
  ShieldCheck,
  Snowflake,
  Tag,
  Table2,
  TableCellsMerge,
  PaintBucket,
} from "lucide-react";
import { getComment } from "@/lib/sheet";
import { type FormatChoice, formatChoiceOf } from "@/lib/cellFormat";
import { isSingleCell } from "@/types/sheet-ui";
import { mergeWouldDiscard, rangeHasMerge } from "@/lib/sheetMerges";
import { isFrozen } from "@/lib/sheetFreeze";
import { ruleAt } from "@/lib/dataValidation";
import { selectActiveSelection, selectActiveSheet, useAnchorFormat, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import { keepGridFocus } from "./keepGridFocus";
import { usePointingActive } from "@/features/grid/PointingBar";
import CommentPopover from "@/features/grid/CommentPopover";
import ValidationPopover from "@/features/grid/ValidationPopover";
import NamesPopover from "@/features/grid/NamesPopover";
import FillColorPopover from "./FillColorPopover";
import clsx from "clsx";

/**
 * Below 1366px the row keeps only what gets pressed every few minutes — bold, italic, underline,
 * alignment and colour — and everything else moves into a sheet that rises from the bottom when
 * "Tools" is pressed (a panel under the button from 1024px). It is the *same* buttons, not a copy:
 * the tools container is `min-[1366px]:contents`, so from 1366px — the narrowest width the whole row
 * was measured to fit at — it dissolves into the row exactly as before, and below that it becomes the
 * sheet. One set of elements means one set of names for a screen reader and for the gates.
 *
 * These strings are whole class names on purpose — Tailwind only generates what it can read.
 * `max-[1366px]:` keeps them from leaking into a wide layout if the sheet was left open on a resize.
 */
const IN_SHEET_BTN =
  "max-[1366px]:group-data-[sheet=open]:w-full max-[1366px]:group-data-[sheet=open]:justify-start max-[1366px]:group-data-[sheet=open]:px-3 max-[1366px]:group-data-[sheet=open]:text-[13px]";
/** A label the wide row hides for space, shown in the sheet where there is room for words. */
const LABEL = "hidden min-[1366px]:inline max-[1366px]:group-data-[sheet=open]:inline";
/** Only ever in the sheet: headings, and words for the buttons the wide row shows as icons. */
const SHEET_ONLY = "hidden max-[1366px]:group-data-[sheet=open]:inline";
const SHEET_HEADING =
  "hidden max-[1366px]:group-data-[sheet=open]:block col-span-2 pt-1 font-mono text-[10.5px] font-medium uppercase tracking-wide text-zinc-500";
const DIVIDER = "mx-1 h-5 w-px shrink-0 bg-zinc-200 max-[1366px]:group-data-[sheet=open]:hidden";

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
  const [fillAt, setFillAt] = useState<{ x: number; y: number } | null>(null);
  const setConvertingDates = useSheetStore((s) => s.setConvertingDates);
  const setFillColor = useSheetStore((s) => s.setFillColor);
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
  const toggleItalic = useSheetStore((s) => s.toggleItalic);
  const toggleUnderline = useSheetStore((s) => s.toggleUnderline);
  const [toolsOpen, setToolsOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  // The sheet is a phone thing. Widen the window with it open and it would otherwise come back the
  // next time the window narrows, over a grid that never asked for it.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1366px)");
    const close = () => wide.matches && setToolsOpen(false);
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);

  useEffect(() => {
    if (!toolsOpen) return;
    toolsRef.current?.querySelector<HTMLElement>("button, select")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setToolsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toolsOpen]);

  /**
   * Where a popover opens. Beside its button on a wide screen; on a phone the button sits in a
   * sheet that is about to close, so the popover goes just under this bar instead — at the top,
   * clear of the keyboard its text box is about to raise.
   */
  const anchorFor = (el: HTMLElement, width: number) => {
    if (window.innerWidth < 1366) {
      const y = (barRef.current?.getBoundingClientRect().bottom ?? 96) + 6;
      // Under the tools panel's own corner from 1024px, where that panel hangs at the right.
      return { x: window.innerWidth < 1024 ? 8 : window.innerWidth - width - 12, y };
    }
    const box = el.getBoundingClientRect();
    return { x: Math.min(box.left, window.innerWidth - width), y: box.bottom + 6 };
  };
  // Three stacked bars ate a fifth of a 768px laptop screen before a single grid row appeared.
  // Formatting is the least-used of the three, so the whole row folds away — hiding only its
  // contents saved 14px and not one extra row, which is decoration rather than a fix.
  const open = useSheetStore((s) => s.formatBarOpen);
  // While a formula is pointed at on a phone the row steps aside: nothing on it applies to a
  // formula half typed, and above a keyboard every row of the grid counts (#99).
  const pointing = usePointingActive();
  if (!open || pointing) return null;


  return (
    <div ref={barRef} className="flex items-center gap-2 scroll-hint-x overflow-x-auto border-b border-zinc-200 bg-white px-2 py-1.5 sm:px-4" onMouseDown={keepGridFocus}>
      {/* The word only on a wide screen: italic and underline made this row 72px longer, and at
          1366px the word was the one thing on it nobody presses. */}
      <span className="hidden shrink-0 text-xs font-medium text-zinc-500 2xl:inline">{t.formatBar.label}</span>
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">

      {/* One group, like alignment beside it: three toggles about the same letters, and joined they
          cost no gaps between them. */}
      <div className="flex shrink-0 overflow-hidden rounded-md border border-zinc-300">
        {(
          [
            { on: Boolean(format.bold), act: toggleBold, title: t.formatBar.boldTitle, Icon: Bold },
            { on: Boolean(format.italic), act: toggleItalic, title: t.formatBar.italicTitle, Icon: Italic },
            { on: Boolean(format.underline), act: toggleUnderline, title: t.formatBar.underlineTitle, Icon: Underline },
          ] as const
        ).map(({ on, act, title, Icon }) => (
          <button
            key={title}
            onClick={act}
            title={title}
            aria-pressed={on}
            className={clsx(
              "flex h-10 w-9 items-center justify-center border-r border-zinc-300 last:border-r-0 lg:h-7 lg:w-7",
              on ? "bg-emerald-50 text-emerald-700" : "text-zinc-600 hover:bg-zinc-50"
            )}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

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
              "flex h-10 w-9 items-center justify-center border-r border-zinc-300 last:border-r-0 lg:h-7 lg:w-7",
              (format.align ?? "left") === v ? "bg-emerald-50 text-emerald-700" : "text-zinc-600 hover:bg-zinc-50"
            )}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      <label title={t.formatBar.colorTitle} className="relative flex h-10 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50 lg:h-7 lg:w-7">
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

      <button
        type="button"
        onClick={() => setToolsOpen((v) => !v)}
        aria-expanded={toolsOpen}
        aria-controls="cell-tools"
        className={clsx(
          "flex h-10 shrink-0 items-center gap-1 rounded-md border px-2.5 text-xs font-medium lg:h-7 min-[1366px]:hidden",
          toolsOpen ? "border-emerald-600 bg-emerald-700 text-white" : "border-zinc-400 text-zinc-800"
        )}
      >
        {t.formatBar.tools} <span aria-hidden>▴</span>
      </button>

      {toolsOpen && <div onClick={() => setToolsOpen(false)} aria-hidden className="fixed inset-0 z-40 bg-zinc-900/30 lg:bg-zinc-900/10 min-[1366px]:hidden" />}

      <div
        id="cell-tools"
        ref={toolsRef}
        data-sheet={toolsOpen ? "open" : "closed"}
        role={toolsOpen ? "dialog" : undefined}
        aria-label={toolsOpen ? t.formatBar.toolsTitle : undefined}
        // Any press in the sheet is the thing the person opened it for, and what it changed is on
        // the grid behind it — so the sheet gets out of the way. Capture phase, because the popover
        // buttons stop their click from bubbling.
        onClickCapture={(e) => {
          if (toolsOpen && (e.target as HTMLElement).closest("button")) setToolsOpen(false);
        }}
        className={clsx(
          "group",
          toolsOpen
            ? "fixed inset-x-0 bottom-0 z-50 grid max-h-[70dvh] grid-cols-2 content-start gap-2 overflow-y-auto rounded-t-2xl border-t border-zinc-200 bg-white px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl lg:inset-x-auto lg:bottom-auto lg:right-3 lg:top-24 lg:w-[26rem] lg:rounded-xl lg:border lg:pb-3"
            : "hidden",
          "min-[1366px]:contents"
        )}
      >
      <div className="col-span-2 flex items-center justify-between min-[1366px]:hidden">
        <p className="text-sm font-semibold text-zinc-800">{t.formatBar.toolsTitle}</p>
        <button type="button" className="flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-zinc-600 hover:bg-zinc-100">
          <X size={16} aria-hidden /> {t.app.close}
        </button>
      </div>

      <p className={SHEET_HEADING}>{t.formatBar.groups.cells}</p>
      <label className="flex shrink-0 items-center gap-2 max-[1366px]:group-data-[sheet=open]:col-span-2">
        <span className={clsx(SHEET_ONLY, "shrink-0 text-[13px] text-zinc-700")}>{t.formatBar.numberFormatTitle}</span>
      <select
        onChange={(e) => {
          setNumberFormat(e.target.value as FormatChoice);
          setToolsOpen(false);
        }}
        value={formatChoiceOf(format.numberFormat, format.dateFormat)}
        aria-label={t.formatBar.numberFormatTitle}
        title={t.formatBar.numberFormatTitle}
        className="h-11 rounded-md border border-zinc-300 px-1.5 text-xs text-zinc-700 outline-none focus:border-emerald-500 max-[1366px]:group-data-[sheet=open]:flex-1 min-[1366px]:h-7"
      >
        {Object.entries(t.numberFormats).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      </label>

      {/* Dates written as text that only a person can say how to read (#82): `15/01/69`. Beside
          the format list because it is the same question — what is in these cells. Not in the row
          from 1366 to 1439px: the row was measured to fit at 1366 with nothing to spare, and this
          would push it 14px off the screen. There, as everywhere, the cell menu has it. */}
      <button
        onClick={() => {
          setConvertingDates(true);
          setToolsOpen(false);
        }}
        aria-label={t.convertDates.button}
        title={t.convertDates.hint}
        aria-haspopup="dialog"
        className={clsx(
          "flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 min-[1366px]:h-7 min-[1366px]:w-7 min-[1366px]:max-[1439px]:hidden",
          IN_SHEET_BTN
        )}
      >
        <CalendarCheck size={14} aria-hidden />
        <span className={SHEET_ONLY}>{t.convertDates.button}</span>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setFillAt(anchorFor(e.currentTarget, 236));
        }}
        title={t.formatBar.fillTitle}
        aria-haspopup="dialog"
        className={clsx(
          "flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 min-[1366px]:h-7 min-[1366px]:w-7",
          IN_SHEET_BTN
        )}
      >
        <span className="flex flex-col items-center" aria-hidden>
          <PaintBucket size={14} />
          <span className="mt-px h-1 w-3.5 rounded-sm border border-zinc-300" style={{ background: format.fill ?? "transparent" }} />
        </span>
        <span className={SHEET_ONLY}>{t.formatBar.fillShort}</span>
      </button>

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
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400 min-[1366px]:h-7 min-[1366px]:min-w-0 min-[1366px]:justify-start",
          IN_SHEET_BTN
        )}
      >
        <TableCellsMerge size={14} />{" "}
        <span className={LABEL}>{merging ? t.merge.split : t.merge.join}</span>
      </button>

      <button
        onClick={toggleFreeze}
        // Disabled at A1 because there is nothing above or to the left of it to freeze, and a
        // button that looks live and does nothing is worse than one that says it cannot.
        disabled={!frozen && selection.anchorRow === 0 && selection.anchorCol === 0}
        aria-label={frozen ? t.freeze.unfreeze : t.freeze.freeze}
        title={frozen ? t.freeze.unfreeze : t.freeze.title}
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400 min-[1366px]:h-7 min-[1366px]:min-w-0 min-[1366px]:justify-start",
          frozen ? "border-blue-400 bg-blue-50 text-blue-800" : "border-zinc-300 text-zinc-700",
          IN_SHEET_BTN
        )}
      >
        <Snowflake size={14} />{" "}
        <span className={LABEL}>{frozen ? t.freeze.unfreeze : t.freeze.freeze}</span>
      </button>

      <div className={DIVIDER} />
      <p className={SHEET_HEADING}>{t.formatBar.groups.sort}</p>

      <button
        onClick={() => sortSelection(true)}
        title={t.formatBar.sortAscTitle}
        className={clsx(
          "flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-zinc-300 text-zinc-600 hover:bg-zinc-50 min-[1366px]:h-7 min-[1366px]:w-7",
          IN_SHEET_BTN
        )}
      >
        <ArrowDownAZ size={14} /> <span className={SHEET_ONLY}>{t.formatBar.sortAscShort}</span>
      </button>
      <button
        onClick={() => sortSelection(false)}
        title={t.formatBar.sortDescTitle}
        className={clsx(
          "flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-zinc-300 text-zinc-600 hover:bg-zinc-50 min-[1366px]:h-7 min-[1366px]:w-7",
          IN_SHEET_BTN
        )}
      >
        <ArrowDownZA size={14} /> <span className={SHEET_ONLY}>{t.formatBar.sortDescShort}</span>
      </button>

      <div className={DIVIDER} />
      <p className={SHEET_HEADING}>{t.formatBar.groups.rules}</p>

      {/* Lives here rather than in the top toolbar: this is formatting, and the toolbar's four
          buttons were already the widest row on a small laptop. */}
      <button
        onClick={() => toggleSidebar("cf")}
        title={t.conditionalFormat.openTitle}
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium min-[1366px]:h-7 min-[1366px]:min-w-0 min-[1366px]:justify-start",
          IN_SHEET_BTN,
          cfOpen ? "border-emerald-600 bg-emerald-700 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        )}
      >
        <Palette size={14} /> <span className={LABEL}>{t.conditionalFormat.title}</span>
      </button>

      {/* A single cell, because a note is about one cell: pointing it at a block would have to
          either fan out into a note per cell or invent a note about a rectangle. */}
      <button
        onClick={(e) => {
          if (!singleCell) return;
          // The popover dismisses itself on any click reaching the window, and this very click is
          // still on its way there — without this it opens and closes in the same gesture.
          e.stopPropagation();
          setCommentAt(anchorFor(e.currentTarget, 300));
        }}
        disabled={!singleCell}
        title={singleCell ? t.comments.openTitle : t.comments.selectCell}
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium min-[1366px]:h-7 min-[1366px]:min-w-0 min-[1366px]:justify-start",
          IN_SHEET_BTN,
          !singleCell
            ? "cursor-not-allowed border-zinc-200 text-zinc-300"
            : existingComment
              ? "border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-100"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        )}
      >
        <MessageSquareText size={14} /> <span className={LABEL}>{t.comments.title}</span>
      </button>


      {/* A rectangle, not a single cell: a dropdown is something you put on a column, and a
          feature that could only do one cell at a time would be set up one cell at a time. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setValidationAt(anchorFor(e.currentTarget, 332));
        }}
        title={t.validation.openTitle}
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium min-[1366px]:h-7 min-[1366px]:min-w-0 min-[1366px]:justify-start",
          IN_SHEET_BTN,
          anchorRule
            ? "border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        )}
      >
        <ShieldCheck size={14} /> <span className={LABEL}>{t.validation.short}</span>
      </button>


      <button
        onClick={(e) => {
          e.stopPropagation();
          setNamesAt(anchorFor(e.currentTarget, 332));
        }}
        title={t.names.openTitle}
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium min-[1366px]:h-7 min-[1366px]:min-w-0 min-[1366px]:justify-start",
          IN_SHEET_BTN,
          sheet.names
            ? "border-sky-500 bg-sky-50 text-sky-800 hover:bg-sky-100"
            : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        )}
      >
        <Tag size={14} /> <span className={LABEL}>{t.names.short}</span>
      </button>

      <p className={SHEET_HEADING}>{t.formatBar.groups.summarise}</p>

      <button
        onClick={() => toggleSidebar("chart")}
        title={t.charts.openTitle}
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium min-[1366px]:h-7 min-[1366px]:min-w-0 min-[1366px]:justify-start",
          IN_SHEET_BTN,
          chartOpen ? "border-emerald-600 bg-emerald-700 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        )}
      >
        <BarChart3 size={14} /> <span className={LABEL}>{t.charts.title}</span>
      </button>



      <button
        onClick={() => toggleSidebar("pivot")}
        title={t.pivot.title}
        className={clsx(
          "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium min-[1366px]:h-7 min-[1366px]:min-w-0 min-[1366px]:justify-start",
          IN_SHEET_BTN,
          pivotOpen ? "border-emerald-600 bg-emerald-700 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        )}
      >
        <Table2 size={14} /> <span className={LABEL}>{t.pivot.title}</span>
      </button>
      </div>
      </div>

      {/* Outside the tools container, so a popover opened from the sheet outlives the sheet. */}
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
      {validationAt && <ValidationPopover anchor={validationAt} onClose={() => setValidationAt(null)} />}
      {namesAt && <NamesPopover anchor={namesAt} onClose={() => setNamesAt(null)} />}
      {fillAt && <FillColorPopover anchor={fillAt} current={format.fill} onPick={setFillColor} onClose={() => setFillAt(null)} />}
    </div>
  );
}
