"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { colToLetters } from "@/lib/sheet";
import { cellRef } from "@/lib/formulaEngine/address";
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
import { COL_WIDTH, ROW_HEADER_WIDTH, ROW_HEIGHT } from "@/lib/gridGeometry";
import ChartOverlay from "./ChartOverlay";
import SelectionHandle from "./SelectionHandle";


export default function SpreadsheetGrid() {
  const t = useT();
  const sheet = useSheetStore(selectActiveSheet);
  const selection = useSheetStore(selectActiveSelection);
  const setSelection = useSheetStore((s) => s.setSelection);
  const commitCell = useSheetStore((s) => s.setCellRaw);
  const openFormulaPanel = useSheetStore((s) => s.openFormulaPanel);
  const clearSelection = useSheetStore((s) => s.clearSelection);
  const clipboard = useSheetStore((s) => s.clipboard);
  const clearClipboard = useSheetStore((s) => s.clearClipboard);
  const deleteSelectedRow = useSheetStore((s) => s.deleteSelectedRow);
  const deleteSelectedColumn = useSheetStore((s) => s.deleteSelectedColumn);
  const insertRowAtSelection = useSheetStore((s) => s.insertRowAtSelection);
  const insertColumnAtSelection = useSheetStore((s) => s.insertColumnAtSelection);
  const addLiveBlock = useSheetStore((s) => s.addLiveBlock);
  const removeLiveBlock = useSheetStore((s) => s.removeLiveBlock);
  const openDataPicker = useSheetStore((s) => s.openDataPicker);
  const { values, display } = useComputedSheet();
  const hiddenRows = useHiddenRows();
  const columnFilters = useActiveFilters();
  const boundCells = useBoundCells();
  const sources = useDataSourceStore((s) => s.sources);
  const rawAt = useCallback((row: number, col: number) => sheet.cells[row]?.[col] ?? "", [sheet]);

  const merges = useMemo(() => mergeLookup(sheet.merges), [sheet.merges]);
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
    container.scrollLeft = Math.min(container.scrollLeft + overflowRight + 8, first.offsetLeft);
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

  const handleKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    if (editing) return;
    const move = (r: number, c: number) => {
      const nr = Math.min(Math.max(r, 0), sheet.rows - 1);
      const nc = Math.min(Math.max(c, 0), sheet.cols - 1);
      setSelection(singleCellSelection(nr, nc));
      e.preventDefault();
    };
    switch (e.key) {
      case "ArrowDown":
      case "Enter":
        move(row + 1, col);
        break;
      case "ArrowUp":
        move(row - 1, col);
        break;
      case "ArrowLeft":
        move(row, col - 1);
        break;
      case "ArrowRight":
      case "Tab":
        move(row, col + 1);
        break;
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
    <div ref={scrollRef} className="relative h-full overflow-auto bg-white" tabIndex={-1}>
      <table className="border-separate border-spacing-0 select-none" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th
              className="sticky top-0 left-0 z-30 border-b border-r border-zinc-200 bg-zinc-100"
              style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH, height: ROW_HEIGHT }}
            />
            {Array.from({ length: sheet.cols }, (_, c) => (
              <th
                key={c}
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
                        "-m-1 rounded p-1.5 hover:bg-zinc-300/60",
                        columnFilters[c]
                          ? "text-emerald-700"
                          : "text-zinc-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
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
          {Array.from({ length: sheet.rows }, (_, r) => r)
            .filter((r) => !hiddenRows.has(r))
            .map((r) => (
            <tr key={r}>
              <th
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
                const choices = templateChoices(sheet.template, r, c);
                const isField = sheet.template !== undefined && !locked;
                return (
                  <td
                    key={c}
                    tabIndex={0}
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
                    onKeyDown={(e) => handleKeyDown(e, r, c)}
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
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

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
