"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  useLiveBlocks,
  useSheetStore,
} from "@/store/sheetStore";
import { useDataSourceStore } from "@/store/dataSourceStore";
import { readLiveDragData } from "@/features/data/dragTypes";
import { getFormulaById } from "@/lib/formulaCatalog";
import ColumnFilterPopover from "./ColumnFilterPopover";
import { useHeaderContextMenu } from "./useHeaderContextMenu";
import { useColumnFilterPopoverState } from "./useColumnFilterPopoverState";
import { useT } from "@/i18n";
import { Filter } from "lucide-react";
import clsx from "clsx";

const ROW_HEADER_WIDTH = 48;
const COL_WIDTH = 112;
const ROW_HEIGHT = 32;

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
  const { values, display } = useComputedSheet();
  const hiddenRows = useHiddenRows();
  const columnFilters = useActiveFilters();
  const boundCells = useBoundCells();
  const liveBlocks = useLiveBlocks();
  const sources = useDataSourceStore((s) => s.sources);
  const rawAt = useCallback((row: number, col: number) => sheet.cells[row]?.[col] ?? "", [sheet]);

  const isBound = (row: number, col: number) => boundCells.has(`${row},${col}`);
  const boundSourceName = (row: number, col: number) => {
    const block = liveBlocks.find((b) => b.id === boundCells.get(`${row},${col}`));
    return sources.find((s) => s.id === block?.sourceId)?.name ?? "";
  };

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing?.row, editing?.col]);

  const startEdit = useCallback(
    (row: number, col: number, initialValue?: string) => {
      if (boundCells.has(`${row},${col}`)) return;
      setEditing({ row, col, value: initialValue ?? rawAt(row, col) });
    },
    [rawAt, boundCells]
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
    <div className="relative h-full overflow-auto bg-white" tabIndex={-1}>
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
                style={{ width: COL_WIDTH, minWidth: COL_WIDTH, height: ROW_HEIGHT }}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>{colToLetters(c)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFilterPopover(e, c);
                    }}
                    title={t.grid.filterColumnTitle}
                    className={clsx(
                      "rounded p-0.5 hover:bg-zinc-300/50",
                      columnFilters[c] ? "text-blue-600" : "text-zinc-400"
                    )}
                  >
                    <Filter size={10} />
                  </button>
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
                return (
                  <td
                    key={c}
                    tabIndex={0}
                    onMouseDown={(e) => handleMouseDown(r, c, e.shiftKey)}
                    onMouseEnter={() => handleMouseEnter(r, c)}
                    onDoubleClick={() => startEdit(r, c)}
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
                      isBound(r, c) && "bg-emerald-50/70",
                      isActive(r, c) && "ring-2 ring-inset ring-blue-500",
                      !isActive(r, c) && isInSelection(r, c) && "bg-blue-50",
                      dragOverCell?.row === r && dragOverCell?.col === c && "bg-emerald-100 ring-2 ring-emerald-400",
                      isInClipboard(r, c) && (clipboard?.cut ? "outline-dashed outline-2 outline-orange-400 -outline-offset-2" : "outline-dashed outline-2 outline-blue-400 -outline-offset-2"),
                      isErr && "text-red-600"
                    )}
                    style={{ width: COL_WIDTH, minWidth: COL_WIDTH, height: ROW_HEIGHT, maxWidth: COL_WIDTH }}
                    title={isBound(r, c) ? t.data.liveCellTitle(boundSourceName(r, c)) : cellRef(r, c)}
                  >
                    {isBound(r, c) && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                    {editingHere ? (
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
                        className="overflow-hidden text-ellipsis whitespace-nowrap leading-8"
                        style={{
                          fontWeight: format?.bold ? 700 : undefined,
                          color: isErr ? undefined : format?.color,
                          textAlign: format?.align,
                        }}
                      >
                        {display[r]?.[c]}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

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
