// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import clsx from "clsx";
import { columnLeft, columnWidth, ROW_HEADER_WIDTH, ROW_HEIGHT, rowHeight, rowTop } from "@/lib/gridGeometry";
import { selectActiveSelection, selectActiveSheet, useHiddenRows, useSelectionAddress, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import { useCoarsePointer } from "./SelectionHandle";

type Side = "left" | "right" | "up" | "down";

/** How long the sheet has to sit still before the chip is worked out: not on every scroll frame. */
const SETTLE_MS = 150;

/**
 * The way back to what you had selected, once it has been scrolled off a phone's screen (#127).
 *
 * On a phone a few sideways swipes are enough to lose the data entirely — the blind test watched
 * someone take five to seven swipes, one column each, to get back from H–J. When the selection is
 * wholly off screen and the sheet has stopped moving, a chip at that edge names it; a tap brings it
 * back. Touch only: a mouse has a scroll bar and Excel's own keys.
 *
 * Also where each sheet keeps its own scroll position. The grid is one scroller for every tab, so
 * a sheet left at H–J used to open the next sheet at H–J too.
 */
export default function BackToSelection() {
  const t = useT();
  const coarse = useCoarsePointer();
  const sheet = useSheetStore(selectActiveSheet);
  const selection = useSheetStore(selectActiveSelection);
  const activeSheetId = useSheetStore((s) => s.activeSheetId);
  const hiddenRows = useHiddenRows();
  const address = useSelectionAddress();
  const [side, setSide] = useState<Side | null>(null);
  const saved = useRef(new Map<string, { left: number; top: number }>());
  const sheetId = useRef(activeSheetId);

  // Where the selection sits against what the scroller shows, measured from the sheet's geometry
  // because a row outside the rendered window has no element to ask.
  const where = (scroller: HTMLElement): Side | null => {
    const left = columnLeft(sheet, selection.startCol);
    const right = columnLeft(sheet, selection.endCol) + columnWidth(sheet, selection.endCol);
    const top = rowTop(sheet, selection.startRow, hiddenRows);
    const bottom = rowTop(sheet, selection.endRow, hiddenRows) + rowHeight(sheet, selection.endRow);
    // The row numbers and column letters are sticky and cover the scroller's first strip.
    if (right <= scroller.scrollLeft + ROW_HEADER_WIDTH) return "left";
    if (left >= scroller.scrollLeft + scroller.clientWidth) return "right";
    if (bottom <= scroller.scrollTop + ROW_HEIGHT) return "up";
    if (top >= scroller.scrollTop + scroller.clientHeight) return "down";
    return null;
  };
  const whereRef = useRef(where);
  useLayoutEffect(() => {
    whereRef.current = where;
  });

  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>("[data-grid-scroller]");
    if (!scroller) return;
    let settle: number | undefined;
    const onScroll = () => {
      saved.current.set(sheetId.current, { left: scroller.scrollLeft, top: scroller.scrollTop });
      window.clearTimeout(settle);
      settle = window.setTimeout(() => setSide(whereRef.current(scroller)), SETTLE_MS);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.clearTimeout(settle);
    };
  }, []);

  // A new selection that is on screen puts the chip away without waiting for a scroll.
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>("[data-grid-scroller]");
    if (scroller) setSide(whereRef.current(scroller));
  }, [selection]);

  // Back to where this sheet was left, or its top-left corner the first time it is shown.
  useLayoutEffect(() => {
    if (sheetId.current === activeSheetId) return;
    sheetId.current = activeSheetId;
    const scroller = document.querySelector<HTMLElement>("[data-grid-scroller]");
    const at = saved.current.get(activeSheetId);
    if (scroller && at) scroller.scrollTo({ left: at.left, top: at.top });
  }, [activeSheetId]);

  if (!coarse || !side) return null;

  const bringBack = () => {
    const scroller = document.querySelector<HTMLElement>("[data-grid-scroller]");
    if (!scroller) return;
    const left = columnLeft(sheet, selection.anchorCol) - ROW_HEADER_WIDTH;
    const top = rowTop(sheet, selection.anchorRow, hiddenRows) - ROW_HEIGHT;
    scroller.scrollTo({
      left: side === "left" || side === "right" ? Math.max(0, left) : scroller.scrollLeft,
      top: side === "up" || side === "down" ? Math.max(0, top) : scroller.scrollTop,
    });
    setSide(null);
  };

  const Icon = { left: ArrowLeft, right: ArrowRight, up: ArrowUp, down: ArrowDown }[side];
  return (
    <button
      onClick={bringBack}
      className={clsx(
        "absolute z-[31] flex min-h-11 items-center gap-1.5 rounded-full bg-blue-700 px-4 text-sm font-semibold text-white shadow-lg",
        side === "left" && "left-14 top-1/2 -translate-y-1/2",
        side === "right" && "right-3 top-1/2 -translate-y-1/2",
        side === "up" && "left-1/2 top-10 -translate-x-1/2",
        side === "down" && "bottom-3 left-1/2 -translate-x-1/2"
      )}
    >
      <Icon size={16} aria-hidden /> {t.grid.backToSelection(address)}
    </button>
  );
}
