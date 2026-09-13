"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cellAt, columnLeft, columnWidth, rowHeight, rowTop } from "@/lib/gridGeometry";
import { SheetModel } from "@/lib/sheet";
import { normalizeSelection, SelectionRect } from "@/types/sheet-ui";
import { useT } from "@/i18n";

/**
 * The grip that extends a selection with a finger.
 *
 * A mouse sweeps a range by holding the button down and moving; touch has no equivalent, because a
 * finger dragged across the grid is how you scroll it, and taking that over would trade one
 * ordinary gesture for another. So touch gets what every mobile spreadsheet gives it: a grip on the
 * corner of the selection, dragged to pull the range out. Only the grip takes the drag, so the rest
 * of the sheet still scrolls normally.
 *
 * Shown only where the pointer is coarse. On a mouse it would sit under the cursor looking like
 * Excel's fill handle and doing something else entirely.
 */

/** How close to an edge a finger has to get before the sheet starts scrolling to meet it. */
const EDGE = 44;
const SCROLL_STEP = 12;
const SCROLL_TICK_MS = 16;

function stopScrolling(timer: React.RefObject<number | null>) {
  if (timer.current !== null) window.clearInterval(timer.current);
  timer.current = null;
}

function subscribeCoarse(onChange: () => void): () => void {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia("(pointer: coarse)").matches,
    // The server has no pointer to ask about. Assuming none keeps the first client render matching
    // the markup; the subscription corrects it a frame later on a device that does have one.
    () => false
  );
}

export default function SelectionHandle({
  sheet,
  selection,
  hiddenRows,
  scrollRef,
  onSelect,
}: {
  sheet: SheetModel;
  selection: SelectionRect;
  hiddenRows: ReadonlySet<number>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (selection: SelectionRect) => void;
}) {
  const t = useT();
  const coarse = useCoarsePointer();
  const [dragging, setDragging] = useState(false);
  /** The last pointer position, so the auto-scroll loop knows where the finger still is after it
   *  has stopped moving. */
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const timer = useRef<number | null>(null);

  const extendTo = useCallback(
    (clientX: number, clientY: number) => {
      const container = scrollRef.current;
      if (!container) return;
      const box = container.getBoundingClientRect();
      const x = clientX - box.left + container.scrollLeft;
      const y = clientY - box.top + container.scrollTop;
      const { row, col } = cellAt(sheet, x, y, hiddenRows);
      onSelect(normalizeSelection({ row: selection.anchorRow, col: selection.anchorCol }, { row, col }));
    },
    [sheet, hiddenRows, onSelect, scrollRef, selection.anchorRow, selection.anchorCol]
  );

  // Cleared on unmount so a drag interrupted by a sheet switch doesn't leave a timer scrolling a
  // container that is no longer there.
  useEffect(() => () => stopScrolling(timer), []);

  if (!coarse) return null;

  const left = columnLeft(sheet, selection.endCol) + columnWidth(sheet, selection.endCol);
  const top = rowTop(sheet, selection.endRow, hiddenRows) + rowHeight(sheet, selection.endRow);

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    // A timer rather than a rAF chain: the loop has to keep running while the finger is held
    // still at the edge, and a self-scheduling callback can't be written as a hook without
    // referring to itself before it exists.
    stopScrolling(timer);
    timer.current = window.setInterval(() => {
      const container = scrollRef.current;
      const at = pointer.current;
      if (!container || !at) return;
      const box = container.getBoundingClientRect();
      // Dragging to the edge scrolls the sheet to meet the finger — without it a range can only
      // ever be as big as the screen, which on a phone is a handful of columns.
      const dx = at.x > box.right - EDGE ? SCROLL_STEP : at.x < box.left + EDGE ? -SCROLL_STEP : 0;
      const dy = at.y > box.bottom - EDGE ? SCROLL_STEP : at.y < box.top + EDGE ? -SCROLL_STEP : 0;
      if (dx === 0 && dy === 0) return;
      container.scrollBy(dx, dy);
      extendTo(at.x, at.y);
    }, SCROLL_TICK_MS);
  };

  const move = (e: React.PointerEvent) => {
    if (!dragging) return;
    pointer.current = { x: e.clientX, y: e.clientY };
    extendTo(e.clientX, e.clientY);
  };

  const end = () => {
    setDragging(false);
    pointer.current = null;
    stopScrolling(timer);
  };

  return (
    <div
      role="slider"
      aria-label={t.grid.extendSelection}
      aria-valuenow={selection.endRow + 1}
      aria-valuemin={1}
      aria-valuemax={sheet.rows}
      tabIndex={0}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      title={t.grid.extendSelection}
      // The grip itself is 10px so it doesn't hide the cell corner, inside a 36px target that a
      // fingertip can actually land on.
      className="absolute z-10 flex h-9 w-9 touch-none items-center justify-center"
      style={{ left: left - 18, top: top - 18 }}
    >
      <span
        className={
          "h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600 shadow " +
          (dragging ? "scale-150 transition-transform" : "")
        }
      />
    </div>
  );
}
