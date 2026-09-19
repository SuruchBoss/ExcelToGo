"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { colToLetters, getComment } from "@/lib/sheet";
import { cellRef } from "@/lib/formulaEngine/address";
import { packCell } from "@/lib/formulaEngine/formulaProgram";
import { FormulaError } from "@/lib/formulaEngine/types";
import { normalizeSelection, singleCellSelection } from "@/types/sheet-ui";
import {
  selectActiveSelection,
  selectActiveSheet,
  useActiveFilters,
  useBoundCells,
  useComputedSheet,
  useHiddenRows,
  useSheetStore,
} from "@/store/sheetStore";
import { useDataSourceStore } from "@/store/dataSourceStore";
import { readLiveDragData } from "@/features/data/dragTypes";
import LiveBlockToolbar from "@/features/data/LiveBlockToolbar";
import { getFormulaById } from "@/lib/formulaCatalog";
import ColumnFilterPopover from "./ColumnFilterPopover";
import { useHeaderContextMenu } from "./useHeaderContextMenu";
import { useColumnFilterPopoverState } from "./useColumnFilterPopoverState";
import { useT } from "@/i18n";
import { Filter } from "lucide-react";
import clsx from "clsx";
import { isTemplateLocked, templateChoices } from "@/lib/sheetTemplate";
import { mergeLookup } from "@/lib/sheetMerges";
import { evaluateConditionalFormats } from "@/lib/conditionalFormat";
import { DEFAULT_FONT_SIZE } from "@/lib/cellFormat";
// Shared with the chart overlay, which places charts in these same coordinates.
import { COL_WIDTH, columnLeft, columnWidth, ROW_HEADER_WIDTH, ROW_HEIGHT } from "@/lib/gridGeometry";
import { rowOffsets, rowWindow, scrollToShowRow } from "@/lib/rowWindow";
import { blockAround, jumpToEdge, pageStep, rowEnd, usedBounds } from "@/lib/gridNavigation";
import ChartOverlay from "./ChartOverlay";
import SelectionHandle from "./SelectionHandle";
import FillHandle from "./FillHandle";


export default function SpreadsheetGrid() {
  const t = useT();
  const sheet = useSheetStore(selectActiveSheet);
  const selection = useSheetStore(selectActiveSelection);
  const setSelection = useSheetStore((s) => s.setSelection);
  const commitCell = useSheetStore((s) => s.setCellRaw);
  const openFormulaPanel = useSheetStore((s) => s.openFormulaPanel);
  const clearSelection = useSheetStore((s) => s.clearSelection);
  const fillWithinSelection = useSheetStore((s) => s.fillWithinSelection);
  const fillFrom = useSheetStore((s) => s.fillFrom);
  const clipboard = useSheetStore((s) => s.clipboard);
  const clearClipboard = useSheetStore((s) => s.clearClipboard);
  const deleteSelectedRow = useSheetStore((s) => s.deleteSelectedRow);
  const deleteSelectedColumn = useSheetStore((s) => s.deleteSelectedColumn);
  const insertRowAtSelection = useSheetStore((s) => s.insertRowAtSelection);
  const insertColumnAtSelection = useSheetStore((s) => s.insertColumnAtSelection);
  const addLiveBlock = useSheetStore((s) => s.addLiveBlock);
  const removeLiveBlock = useSheetStore((s) => s.removeLiveBlock);
  const openDataPicker = useSheetStore((s) => s.openDataPicker);
  const { values, display, spill } = useComputedSheet();
  const hiddenRows = useHiddenRows();
  const columnFilters = useActiveFilters();
  const boundCells = useBoundCells();
  const sources = useDataSourceStore((s) => s.sources);
  const rawAt = useCallback((row: number, col: number) => sheet.cells[row]?.[col] ?? "", [sheet]);

  const merges = useMemo(() => mergeLookup(sheet.merges), [sheet.merges]);

  // ── Only the rows on screen go in the DOM ──────────────────────────────────────────────────
  //
  // Below this a sheet is small enough that a window costs more than it saves, and the default
  // thirty-row sheet — every screenshot, every test, the demo — renders exactly as it always did.
  const VIRTUALIZE_ABOVE = 200;
  const OVERSCAN_PX = 600;
  const virtualized = sheet.rows > VIRTUALIZE_ABOVE;

  const [viewport, setViewport] = useState({ top: 0, height: 0 });
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || !virtualized) return;
    let queued = false;
    const measure = () => {
      queued = false;
      setViewport((prev) =>
        prev.top === container.scrollTop && prev.height === container.clientHeight
          ? prev
          : { top: container.scrollTop, height: container.clientHeight }
      );
    };
    // One measurement per frame: a scroll fires far more often than the screen redraws, and each
    // one of these ends in a React render.
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    };
    measure();
    container.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => {
      container.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [virtualized]);

  const offsets = useMemo(
    () => rowOffsets(sheet.rows, (r) => sheet.rowHeights?.[r] ?? ROW_HEIGHT, hiddenRows),
    [sheet.rows, sheet.rowHeights, hiddenRows]
  );

  const window_ = useMemo(
    () =>
      virtualized
        ? rowWindow({
            rows: sheet.rows,
            offsets,
            scrollTop: viewport.top,
            viewportHeight: viewport.height,
            overscan: OVERSCAN_PX,
            merges: sheet.merges,
          })
        : { start: 0, end: sheet.rows - 1, topPad: 0, bottomPad: 0 },
    [virtualized, sheet.rows, sheet.merges, offsets, viewport.top, viewport.height]
  );


  const visibleRows = useMemo(() => {
    const out: number[] = [];
    for (let r = window_.start; r <= window_.end; r++) if (!hiddenRows.has(r)) out.push(r);
    return out;
  }, [window_.start, window_.end, hiddenRows]);

  // Follow the cursor.
  //
  // Two reasons, and the second one is not optional: a row outside the window is not in the DOM at
  // all, so nothing can be asked to scroll itself into view — the position has to be worked out.
  // And with the jump keys the cursor can now land three thousand rows away in one press, which is
  // no use if the screen stays where it was.
  //
  // Keyed on the corner the keyboard is dragging rather than the anchor, so Shift+Down keeps the
  // growing edge on screen instead of the end it is growing away from.
  const focusRow = selection.anchorRow === selection.startRow ? selection.endRow : selection.startRow;
  const focusCol = selection.anchorCol === selection.startCol ? selection.endCol : selection.startCol;
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const top = scrollToShowRow(offsets, focusRow, container.scrollTop, container.clientHeight, ROW_HEIGHT);

    const left = columnLeft(sheet, focusCol);
    const right = left + columnWidth(sheet, focusCol);
    let nextLeft: number | null = null;
    // ROW_HEADER_WIDTH, because the row numbers are sticky and float over the left of the scroller.
    if (left < container.scrollLeft + ROW_HEADER_WIDTH) nextLeft = Math.max(0, left - ROW_HEADER_WIDTH);
    else if (right > container.scrollLeft + container.clientWidth) nextLeft = right - container.clientWidth;

    if (top === null && nextLeft === null) return;
    container.scrollTo({ top: top ?? container.scrollTop, left: nextLeft ?? container.scrollLeft });
  }, [focusRow, focusCol, offsets, sheet]);
  // Recomputed from values, not stored: that is the whole point — edit a number and its colour
  // follows on the same render.
  const cfVisuals = useMemo(
    () => evaluateConditionalFormats(sheet.conditionalRules, values, sheet.rows, sheet.cols),
    [sheet.conditionalRules, values, sheet.rows, sheet.cols]
  );
  /** Columns with at least one non-empty cell. Only those can meaningfully be filtered. */
  const columnsWithContent = useMemo(() => {
    const out = new Set<number>();
    for (let c = 0; c < sheet.cols; c++) {
      for (let r = 0; r < sheet.rows; r++) {
        if (sheet.cells[r]?.[c]) {
          out.add(c);
          break;
        }
      }
    }
    return out;
  }, [sheet]);
  const hasContent = (col: number) => columnsWithContent.has(col);
  const blockAt = (row: number, col: number) => boundCells.get(`${row},${col}`);
  const isBound = (row: number, col: number) => boundCells.has(`${row},${col}`);
  const sourceNameOf = (sourceId: string) => sources.find((s) => s.id === sourceId)?.name ?? "";
  const selectedBlock = blockAt(selection.anchorRow, selection.anchorCol);

  const onFormulaDrop = (row: number, col: number, formulaId: string) => {
    const def = getFormulaById(t, formulaId);
    if (!def) return;
    setSelection(singleCellSelection(row, col));
    openFormulaPanel(def, row, col);
  };

  const onLiveDrop = (row: number, col: number, e: React.DragEvent) => {
    const payload = readLiveDragData(e);
    if (!payload) return false;
    setSelection(singleCellSelection(row, col));
    addLiveBlock(
      { sourceId: payload.sourceId, anchorRow: row, anchorCol: col, kind: payload.kind, column: payload.column, aggregate: payload.aggregate },
      useDataSourceStore.getState().data[payload.sourceId]
    );
    return true;
  };

  const [editing, setEditing] = useState<{ row: number; col: number; value: string } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ row: number; col: number } | null>(null);
  const isSelecting = useRef(false);
  /** Whether the cell a touch landed on was already the selected one, sampled before the tap
   *  changes the selection. See the pointer handlers on each cell for why. */
  const tappedAlreadySelected = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing?.row, editing?.col]);

  /**
   * Put the browser's focus where the cursor is.
   *
   * Two jobs in one effect, because they are the same move.
   *
   * The first is keeping the keyboard alive when the rows underneath it are recycled: a jump
   * scrolls the grid, the scroll listener re-measures a frame later, and the `<td>` that had focus
   * is unmounted — focus falls to `<body>` and the next keystroke is the browser's own scrolling
   * rather than the grid's. That is why the window is in the dependency list as well as the
   * cursor: the unmount happens after the cursor has finished moving.
   *
   * The second is that a screen reader announces a cell when focus lands on it, and nothing else.
   * Before this, selection and focus were separate things — Ctrl+↓ moved the cursor from A1 to A10
   * while the browser's focus stayed on A1, so the sheet moved under a blind user in total silence.
   * The selection ring was the only report that anything had happened.
   *
   * It follows the *moving* corner, not the anchor. Shift+Down leaves the anchor exactly where it
   * was, so keying this on the anchor would grow the selection in the same silence the bug above
   * was about. For a single cell the two corners are the same cell and nothing changes.
   *
   * Never from focus that is legitimately elsewhere — the formula bar, a panel, a dialog, or the
   * cell editor. Stealing it back from those would be a worse bug than either of the ones fixed.
   */
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || editing) return;
    const active = document.activeElement;
    const ours = active === document.body || active === container || (active instanceof Node && container.contains(active));
    if (!ours) return;
    const cell = container.querySelector<HTMLElement>(`td[data-row="${focusRow}"][data-col="${focusCol}"]`);
    // No cell means the cursor is on a row scrolled out of the window, hidden by a filter, or
    // swallowed by a merge. The scroller still holds the keyboard, so the keys keep working.
    (cell ?? container).focus({ preventScroll: true });
  }, [focusRow, focusCol, window_.start, window_.end, editing]);

  // Placing a block wide enough to run past the right edge used to leave the user staring at its
  // first two columns with no sign the rest existed. Scroll just far enough to show the whole
  // block, and never so far that its left edge leaves the screen.
  const placedBlockId = selectedBlock?.id;
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || !selectedBlock) return;
    const first = container.querySelector<HTMLElement>(`td[data-row="${selectedBlock.anchorRow}"][data-col="${selectedBlock.anchorCol}"]`);
    const last = container.querySelector<HTMLElement>(
      `td[data-row="${selectedBlock.anchorRow}"][data-col="${selectedBlock.anchorCol + selectedBlock.cols - 1}"]`
    );
    if (!first || !last) return;
    const overflowRight = last.offsetLeft + last.offsetWidth - (container.scrollLeft + container.clientWidth);
    if (overflowRight <= 0) return;
    // scrollTo rather than assigning scrollLeft: the compiler's immutability rule reads a write
    // through a ref as mutating the ref itself, and a method call says the same thing without it.
    const left = Math.min(container.scrollLeft + overflowRight + 8, first.offsetLeft);
    container.scrollTo({ left, top: container.scrollTop });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a newly selected block, not on every refresh that resizes it
  }, [placedBlockId]);

  const startEdit = useCallback(
    (row: number, col: number, initialValue?: string) => {
      if (boundCells.has(`${row},${col}`)) return;
      if (isTemplateLocked(sheet.template, row, col)) return;
      setEditing({ row, col, value: initialValue ?? rawAt(row, col) });
    },
    [rawAt, boundCells, sheet.template]
  );

  const commitEdit = useCallback(() => {
    if (!editing) return;
    commitCell(editing.row, editing.col, editing.value);
    setEditing(null);
  }, [editing, commitCell]);

  const handleMouseDown = (row: number, col: number, shiftKey: boolean) => {
    if (editing && (editing.row !== row || editing.col !== col)) commitEdit();
    isSelecting.current = true;
    if (shiftKey) {
      setSelection(normalizeSelection({ row: selection.anchorRow, col: selection.anchorCol }, { row, col }));
    } else {
      setSelection(singleCellSelection(row, col));
    }
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (!isSelecting.current) return;
    setSelection(normalizeSelection({ row: selection.anchorRow, col: selection.anchorCol }, { row, col }));
  };

  const selectWholeRow = (row: number) =>
    setSelection({ anchorRow: row, anchorCol: 0, startRow: row, startCol: 0, endRow: row, endCol: sheet.cols - 1 });
  const selectWholeColumn = (col: number) =>
    setSelection({ anchorRow: 0, anchorCol: col, startRow: 0, startCol: col, endRow: sheet.rows - 1, endCol: col });

  const { menu: contextMenu, open: openHeaderMenu, close: closeHeaderMenu } = useHeaderContextMenu((type, index) => {
    if (type === "row") selectWholeRow(index);
    else selectWholeColumn(index);
  });
  const { popover: filterPopover, toggle: toggleFilterPopover, close: closeFilterPopover } = useColumnFilterPopoverState();

  useEffect(() => {
    const up = () => (isSelecting.current = false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  /**
   * The hands go before the eyes do.
   *
   * Somebody who opens a spreadsheet presses Ctrl+Down before they read a word of the page, and a
   * grid that answers by moving one row tells them it is a mock-up. So the jumps are here, in the
   * shapes Excel uses: Ctrl to the edge of the data, Shift to drag the selection with you, both
   * together to do each at once, and Home/End/Page to the extremes.
   *
   * The rules themselves live in `lib/gridNavigation.ts` and are tested on hand-drawn grids; what
   * is here is only which keys reach them.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;
    const row = selection.anchorRow;
    const col = selection.anchorCol;
    const bounds = { rows: sheet.rows, cols: sheet.cols };
    const isEmpty = (r: number, c: number) => (sheet.cells[r]?.[c] ?? "") === "";
    const jump = e.ctrlKey || e.metaKey;
    // Read at the keystroke rather than kept in state: the windowing effect only measures while
    // it is switched on, and Page keys have to work on a small sheet too.
    const pageHeight = scrollRef.current?.clientHeight ?? 0;

    /**
     * Move the cursor, or — holding Shift — drag the far corner of the selection to it.
     *
     * The corner that moves is the one opposite the anchor, worked out from the rectangle rather
     * than stored: the anchor is always on a corner, so the other one is implied. That keeps
     * Shift+Down twice growing the same selection instead of starting a new one each time.
     */
    const go = (r: number, c: number) => {
      const nr = Math.min(Math.max(r, 0), sheet.rows - 1);
      const nc = Math.min(Math.max(c, 0), sheet.cols - 1);
      if (e.shiftKey) {
        const anchor = { row: selection.anchorRow, col: selection.anchorCol };
        setSelection(normalizeSelection(anchor, { row: nr, col: nc }));
      } else {
        setSelection(singleCellSelection(nr, nc));
      }
      e.preventDefault();
    };

    /** The corner the keyboard is currently dragging. */
    const focusRow = selection.anchorRow === selection.startRow ? selection.endRow : selection.startRow;
    const focusCol = selection.anchorCol === selection.startCol ? selection.endCol : selection.startCol;
    const fromRow = e.shiftKey ? focusRow : row;
    const fromCol = e.shiftKey ? focusCol : col;

    const step = (dRow: number, dCol: number) => {
      if (jump) {
        const to = jumpToEdge(isEmpty, bounds, { row: fromRow, col: fromCol }, dRow, dCol);
        go(to.row, to.col);
      } else {
        go(fromRow + dRow, fromCol + dCol);
      }
    };

    switch (e.key) {
      case "ArrowDown":
        step(1, 0);
        break;
      case "Enter":
        // Enter commits and walks down a column, Shift+Enter back up it — and neither extends a
        // selection, which is why it does not go through `step`.
        setSelection(singleCellSelection(Math.min(Math.max(row + (e.shiftKey ? -1 : 1), 0), sheet.rows - 1), col));
        e.preventDefault();
        break;
      case "ArrowUp":
        step(-1, 0);
        break;
      case "ArrowLeft":
        step(0, -1);
        break;
      case "ArrowRight":
        step(0, 1);
        break;
      case "Tab":
        setSelection(singleCellSelection(row, Math.min(Math.max(col + (e.shiftKey ? -1 : 1), 0), sheet.cols - 1)));
        e.preventDefault();
        break;
      case "Home":
        // Home to the start of the row, Ctrl+Home to the start of the sheet.
        go(jump ? 0 : fromRow, 0);
        break;
      case "End": {
        // End to the last filled cell in the row, Ctrl+End to the corner of everything used.
        const to = jump ? usedBounds(isEmpty, bounds) : { row: fromRow, col: rowEnd(isEmpty, bounds, fromRow) };
        go(to.row, to.col);
        break;
      }
      case "PageDown":
        go(pageStep(offsets, fromRow, pageHeight, 1), fromCol);
        break;
      case "PageUp":
        go(pageStep(offsets, fromRow, pageHeight, -1), fromCol);
        break;
      // Excel's fill keys, and the only way to reach the fill handle without a pointer. `D` fills
      // the selection down from its first row, `R` rightwards from its first column — which is
      // what the handle does when you drag it, so one implementation serves both.
      case "d":
      case "D":
        if (jump) {
          fillWithinSelection("down");
          e.preventDefault();
          break;
        }
        startEdit(row, col, e.key);
        break;
      case "r":
      case "R":
        if (jump) {
          fillWithinSelection("right");
          e.preventDefault();
          break;
        }
        startEdit(row, col, e.key);
        break;
      case "a":
      case "A": {
        if (!jump) {
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) startEdit(row, col, e.key);
          break;
        }
        // Excel's two-step: the table you are standing in, then everything.
        const block = blockAround(isEmpty, bounds, { row, col });
        const alreadyBlock =
          selection.startRow === block.startRow &&
          selection.startCol === block.startCol &&
          selection.endRow === block.endRow &&
          selection.endCol === block.endCol;
        const target = alreadyBlock
          ? { startRow: 0, startCol: 0, endRow: sheet.rows - 1, endCol: sheet.cols - 1 }
          : block;
        setSelection({
          anchorRow: target.startRow,
          anchorCol: target.startCol,
          startRow: target.startRow,
          startCol: target.startCol,
          endRow: target.endRow,
          endCol: target.endCol,
        });
        e.preventDefault();
        break;
      }
      case "Delete":
      case "Backspace":
        if (!isBound(row, col)) clearSelection();
        e.preventDefault();
        break;
      case "F2":
        startEdit(row, col);
        e.preventDefault();
        break;
      case "Escape":
        if (clipboard) {
          clearClipboard();
          e.preventDefault();
        }
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          startEdit(row, col, e.key);
        }
    }
  };

  const isInSelection = (row: number, col: number) =>
    row >= selection.startRow && row <= selection.endRow && col >= selection.startCol && col <= selection.endCol;
  const isActive = (row: number, col: number) => row === selection.anchorRow && col === selection.anchorCol;
  const isInClipboard = (row: number, col: number) => {
    if (!clipboard) return false;
    const endRow = clipboard.startRow + clipboard.rows.length - 1;
    const endCol = clipboard.startCol + (clipboard.rows[0]?.length ?? 0) - 1;
    return row >= clipboard.startRow && row <= endRow && col >= clipboard.startCol && col <= endCol;
  };

  return (
    // The keyboard is owned by the scroller, not by the cells. A cell handler worked until the
    // grid started windowing rows: Ctrl+Down unmounts the very <td> the keystroke came from, focus
    // falls to <body>, and every key after that is the browser's own scrolling rather than ours.
    // Focus lands here instead, which survives any amount of the sheet being recycled.
    <div
      ref={scrollRef}
      className="relative h-full overflow-auto bg-white"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {/*
        `role="grid"`, and the row/column counts that go with it.
        ------------------------------------------------------------------------------------------
        The axe gate passed this grid at four viewport/page combinations while it was, to a screen
        reader, a plain data table you could not drive: no grid role, no selected state, headers
        with no `scope`, and every cell tabbable so Tab walked one cell at a time through ten
        thousand of them. axe was right to pass — a `<table>` with `<th>` *is* a valid table. It
        just was not what this is.

        The counts are declared rather than implied because the sheet is windowed: about forty rows
        of five thousand are in the DOM at any moment, so `aria-rowcount` and the per-row
        `aria-rowindex` are the only way the answer to "row 2,003 of 5,000" exists at all. The
        header row is index 1, so data row `r` is `r + 2`; likewise the row-number column is
        column 1, so data column `c` is `c + 2`.
      */}
      <table
        role="grid"
        aria-label={t.grid.label}
        aria-multiselectable
        aria-rowcount={sheet.rows + 1}
        aria-colcount={sheet.cols + 1}
        className="border-separate border-spacing-0 select-none"
        style={{ tableLayout: "fixed" }}
      >
        <thead>
          <tr aria-rowindex={1}>
            <th
              scope="col"
              aria-colindex={1}
              className="sticky top-0 left-0 z-30 border-b border-r border-zinc-200 bg-zinc-100"
              style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH, height: ROW_HEIGHT }}
            >
              <span className="sr-only">{t.grid.cornerHeader}</span>
            </th>
            {Array.from({ length: sheet.cols }, (_, c) => (
              <th
                key={c}
                scope="col"
                aria-colindex={c + 2}
                onClick={() => selectWholeColumn(c)}
                onContextMenu={(e) => openHeaderMenu(e, "col", c)}
                className={clsx(
                  "sticky top-0 z-20 cursor-pointer border-b border-r border-zinc-200 text-xs font-semibold text-zinc-600",
                  c >= selection.startCol && c <= selection.endCol ? "bg-blue-100 text-blue-800" : "bg-zinc-100"
                )}
                style={(() => {
                  const w = sheet.colWidths?.[c] ?? COL_WIDTH;
                  return { width: w, minWidth: w, height: ROW_HEIGHT };
                })()}
              >
                <div className="group flex items-center justify-center gap-1">
                  <span>{colToLetters(c)}</span>
                  {(hasContent(c) || columnFilters[c]) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFilterPopover(e, c);
                      }}
                      title={t.grid.filterColumnTitle}
                      className={clsx(
                        // 14px of icon was a 14px target. The padding makes it 24px without
                        // making the glyph any louder.
                        "-m-1 rounded p-2 hover:bg-zinc-300/60",
                        columnFilters[c]
                          ? "text-emerald-700"
                          // Quiet until pointed at — but only where pointing exists. A phone has no
                          // hover, so this hid sort-and-filter from every touch user completely:
                          // the button was there, fully clickable, at opacity zero.
                          : "text-zinc-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                      )}
                    >
                      <Filter size={11} />
                    </button>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* One row standing in for everything scrolled past, so the scrollbar still measures the
              whole sheet. `aria-hidden` because it is a shim, not a row anyone can be in. */}
          {window_.topPad > 0 && (
            <tr aria-hidden>
              <td colSpan={sheet.cols + 1} style={{ height: window_.topPad, padding: 0, border: 0 }} />
            </tr>
          )}
          {visibleRows.map((r) => (
            <tr key={r} aria-rowindex={r + 2}>
              <th
                scope="row"
                aria-colindex={1}
                onClick={() => selectWholeRow(r)}
                onContextMenu={(e) => openHeaderMenu(e, "row", r)}
                className={clsx(
                  "sticky left-0 z-10 cursor-pointer border-b border-r border-zinc-200 text-xs font-semibold text-zinc-600",
                  r >= selection.startRow && r <= selection.endRow ? "bg-blue-100 text-blue-800" : "bg-zinc-100"
                )}
                style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH, height: ROW_HEIGHT }}
              >
                {r + 1}
              </th>
              {Array.from({ length: sheet.cols }, (_, c) => {
                const value = values[r]?.[c];
                const isErr = value instanceof FormulaError;
                const editingHere = editing?.row === r && editing?.col === c;
                const format = sheet.formats[r]?.[c];
                const cf = cfVisuals[r]?.[c];
                const block = blockAt(r, c);
                // A cell swallowed by a merge isn't rendered at all — its space belongs to the
                // merge's top-left cell, which carries the span.
                if (merges.covered.has(`${r},${c}`)) return null;
                const merge = merges.anchors.get(`${r},${c}`);
                const locked = isTemplateLocked(sheet.template, r, c);
                const comment = getComment(sheet.comments, r, c);
                const choices = templateChoices(sheet.template, r, c);
                const isField = sheet.template !== undefined && !locked;
                // Borrowed from a formula in another cell: the value is real, the cell is empty.
                // Typing here breaks the array into #SPILL!, which is Excel's behaviour and needs
                // no code — the raw text stops being empty and the anchor refuses on the next pass.
                const spilledFrom = spill.get(packCell(r, c));
                const isSpilled = spilledFrom !== undefined && spilledFrom !== packCell(r, c);
                return (
                  <td
                    key={c}
                    role="gridcell"
                    aria-selected={isInSelection(r, c)}
                    aria-colindex={c + 2}
                    aria-readonly={locked || undefined}
                    // One tab stop for the whole grid, not one per cell — the roving tabindex the
                    // grid pattern calls for. Every cell was tabbable before, which on the sample
                    // sheet alone meant walking three hundred Tab presses to reach the sheet tabs.
                    tabIndex={isActive(r, c) ? 0 : -1}
                    data-row={r}
                    data-col={c}
                    rowSpan={merge ? merge.endRow - merge.startRow + 1 : undefined}
                    colSpan={merge ? merge.endCol - merge.startCol + 1 : undefined}
                    onMouseDown={(e) => handleMouseDown(r, c, e.shiftKey)}
                    onMouseEnter={() => handleMouseEnter(r, c)}
                    onDoubleClick={() => startEdit(r, c)}
                    // Touch has no keyboard to start typing into and no comfortable double-tap, so
                    // a second tap on the cell already selected opens the editor — the pattern
                    // every mobile spreadsheet uses. Sampled on pointerdown because mousedown has
                    // already moved the selection by the time pointerup runs, which would make the
                    // very first tap open the editor.
                    onPointerDown={(e) => {
                      if (e.pointerType === "touch") tappedAlreadySelected.current = isActive(r, c);
                    }}
                    onPointerUp={(e) => {
                      if (e.pointerType !== "touch" || !tappedAlreadySelected.current) return;
                      if (!editingHere && !locked) startEdit(r, c);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverCell({ row: r, col: c });
                    }}
                    onDragLeave={() => setDragOverCell(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverCell(null);
                      if (onLiveDrop(r, c, e)) return;
                      const formulaId = e.dataTransfer.getData("text/formula-id");
                      if (formulaId) {
                        setSelection(singleCellSelection(r, c));
                        onFormulaDrop(r, c, formulaId);
                      }
                    }}
                    className={clsx(
                      "relative border-b border-r border-zinc-200 px-2 text-sm outline-none",
                      // A live block reads as one object: tinted fill, a green outline on its edges,
                      // and its header row set apart from the values below it.
                      block && "bg-emerald-50/70",
                      block && block.kind === "table" && r === block.anchorRow && "font-semibold text-emerald-800",
                      block && r === block.anchorRow && "border-t-2 border-t-emerald-200",
                      block && c === block.anchorCol && "border-l-2 border-l-emerald-200",
                      block && c === block.anchorCol + block.cols - 1 && "border-r-2 border-r-emerald-200",
                      block && r === block.anchorRow + block.rows - 1 && "border-b-2 border-b-emerald-200",
                      // A form reads the way a paper one does: the printed parts are flat and
                      // grey, the blanks are white. Amber is kept for warnings alone — dressing
                      // twenty ordinary input cells in it made a form look like twenty alerts.
                      // Faint on purpose. It has to be visible enough that "why can I not edit
                      // this" has an answer on screen, and quiet enough that a filled array does
                      // not look like an error next to ordinary numbers.
                      isSpilled && "bg-violet-50/60 text-violet-900",
                      locked && "bg-zinc-100 text-zinc-500",
                      isField && "bg-white ring-1 ring-inset ring-emerald-400",
                      isActive(r, c) && "ring-2 ring-inset ring-blue-500",
                      !isActive(r, c) && isInSelection(r, c) && "bg-blue-50",
                      dragOverCell?.row === r && dragOverCell?.col === c && "bg-emerald-100 ring-2 ring-emerald-400",
                      isInClipboard(r, c) && (clipboard?.cut ? "outline-dashed outline-2 outline-orange-400 -outline-offset-2" : "outline-dashed outline-2 outline-blue-400 -outline-offset-2"),
                      isErr && "text-red-600"
                    )}
                    style={(() => {
                      const h = sheet.rowHeights?.[r] ?? ROW_HEIGHT;
                      // Where the file drew a border, it replaces the grid's own faint line —
                      // a 1px default would otherwise hide the heavy rule under a table heading.
                      const b = format?.borders;
                      const edge = (color: string | undefined) =>
                        color ? { style: "solid" as const, width: 2, color } : undefined;
                      const borders = {
                        borderTopStyle: edge(b?.top)?.style,
                        borderTopWidth: edge(b?.top)?.width,
                        borderTopColor: b?.top,
                        borderRightStyle: edge(b?.right)?.style,
                        borderRightWidth: edge(b?.right)?.width,
                        borderRightColor: b?.right,
                        borderBottomStyle: edge(b?.bottom)?.style,
                        borderBottomWidth: edge(b?.bottom)?.width,
                        borderBottomColor: b?.bottom,
                        borderLeftStyle: edge(b?.left)?.style,
                        borderLeftWidth: edge(b?.left)?.width,
                        borderLeftColor: b?.left,
                      };
                      // A rule's fill replaces the painted-on one: the value is the more current
                      // answer, and showing the stale colour underneath would just muddy it.
                      const background = cf?.fill ?? format?.fill;
                      // A data bar is drawn as a hard-edged gradient rather than a child element,
                      // so it sits behind the text without disturbing the cell's layout.
                      const bar = cf?.bar
                        ? {
                            backgroundImage: `linear-gradient(to right, ${cf.bar.color} ${cf.bar.fraction * 100}%, transparent ${cf.bar.fraction * 100}%)`,
                          }
                        : undefined;
                      // A merged cell's box comes from the columns and rows it spans, so pinning
                      // it to a single column's width would squash it back to one cell.
                      if (merge) return { height: h, backgroundColor: background, ...bar, ...borders };
                      const w = sheet.colWidths?.[c] ?? COL_WIDTH;
                      return { width: w, minWidth: w, maxWidth: w, height: h, backgroundColor: background, ...bar, ...borders };
                    })()}
                    title={
                      block
                        ? t.data.liveCellTitle(sourceNameOf(block.sourceId))
                        : locked
                          ? t.template.lockedCell
                          : cellRef(r, c)
                    }
                  >
                    {editingHere && choices ? (
                      <select
                        autoFocus
                        className="absolute inset-0 z-40 h-full w-full border-2 border-emerald-500 bg-white px-1 text-sm outline-none"
                        value={editing.value}
                        onChange={(e) => {
                          commitCell(r, c, e.target.value);
                          setEditing(null);
                        }}
                        onBlur={() => setEditing(null)}
                      >
                        <option value="">{t.template.choosePlaceholder}</option>
                        {choices.map((choice) => (
                          <option key={choice} value={choice}>
                            {choice}
                          </option>
                        ))}
                      </select>
                    ) : editingHere ? (
                      <input
                        ref={inputRef}
                        className="absolute inset-0 z-40 h-full w-full border-2 border-blue-500 bg-white px-2 text-sm outline-none"
                        value={editing.value}
                        onChange={(e) => setEditing({ row: r, col: c, value: e.target.value })}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            commitEdit();
                            setSelection(singleCellSelection(Math.min(r + 1, sheet.rows - 1), c));
                          } else if (e.key === "Escape") {
                            setEditing(null);
                          } else if (e.key === "Tab") {
                            e.preventDefault();
                            commitEdit();
                            setSelection(singleCellSelection(r, Math.min(c + 1, sheet.cols - 1)));
                          }
                        }}
                      />
                    ) : (
                      <div
                        className="flex h-full overflow-hidden"
                        style={{
                          alignItems: format?.valign === "top" ? "flex-start" : format?.valign === "bottom" ? "flex-end" : "center",
                          justifyContent:
                            format?.align === "center" ? "center" : format?.align === "right" ? "flex-end" : "flex-start",
                        }}
                      >
                        <span
                          className="overflow-hidden text-ellipsis whitespace-nowrap"
                          style={{
                            fontWeight: format?.bold || cf?.bold ? 700 : undefined,
                            fontStyle: format?.italic ? "italic" : undefined,
                            textDecoration: format?.underline ? "underline" : undefined,
                            fontSize: format?.fontSize ? `${format.fontSize / DEFAULT_FONT_SIZE}em` : undefined,
                            lineHeight: 1.25,
                            color: isErr ? undefined : cf?.color ?? format?.color,
                            textAlign: format?.align,
                          }}
                        >
                          {display[r]?.[c]}
                        </span>
                      </div>
                    )}
                    {/* The corner Excel uses, so a note is visible without hovering every cell to
                        find one. `title` carries the text for a mouse; touch reads it by selecting
                        the cell and opening the editor. */}
                    {comment && (
                      <span
                        title={comment}
                        aria-label={comment}
                        className="pointer-events-auto absolute right-0 top-0 h-0 w-0 border-l-[6px] border-t-[6px] border-l-transparent border-t-amber-500"
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {window_.bottomPad > 0 && (
            <tr aria-hidden>
              <td colSpan={sheet.cols + 1} style={{ height: window_.bottomPad, padding: 0, border: 0 }} />
            </tr>
          )}
        </tbody>
      </table>

      <FillHandle
        sheet={sheet}
        selection={selection}
        hiddenRows={hiddenRows}
        scrollRef={scrollRef}
        onFill={fillFrom}
      />
      <SelectionHandle
        sheet={sheet}
        selection={selection}
        hiddenRows={hiddenRows}
        scrollRef={scrollRef}
        onSelect={setSelection}
      />

      <ChartOverlay sheet={sheet} values={values} hiddenRows={hiddenRows} />

      {selectedBlock && (
        <LiveBlockToolbar
          key={selectedBlock.id}
          block={selectedBlock}
          sourceName={sourceNameOf(selectedBlock.sourceId)}
          refreshSec={sources.find((s) => s.id === selectedBlock.sourceId)?.refreshSec ?? 0}
          containerRef={scrollRef}
          onRefresh={() => void useDataSourceStore.getState().refresh(selectedBlock.sourceId)}
          onChange={() => openDataPicker({ sourceId: selectedBlock.sourceId, replacingBlockId: selectedBlock.id })}
          onRemove={() => removeLiveBlock(selectedBlock.id)}
        />
      )}

      {contextMenu && (
        <div
          className="fixed z-50 w-44 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "row" ? (
            <>
              <button
                onClick={() => {
                  insertRowAtSelection();
                  closeHeaderMenu();
                }}
                className="block w-full px-3 py-1.5 text-left hover:bg-zinc-50"
              >
                {t.grid.insertRowAbove}
              </button>
              <button
                onClick={() => {
                  deleteSelectedRow();
                  closeHeaderMenu();
                }}
                className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
              >
                {t.grid.deleteRow}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  insertColumnAtSelection();
                  closeHeaderMenu();
                }}
                className="block w-full px-3 py-1.5 text-left hover:bg-zinc-50"
              >
                {t.grid.insertColumnLeft}
              </button>
              <button
                onClick={() => {
                  deleteSelectedColumn();
                  closeHeaderMenu();
                }}
                className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
              >
                {t.grid.deleteColumn}
              </button>
            </>
          )}
        </div>
      )}

      {filterPopover && (
        <ColumnFilterPopover col={filterPopover.col} x={filterPopover.x} y={filterPopover.y} onClose={closeFilterPopover} />
      )}
    </div>
  );
}
