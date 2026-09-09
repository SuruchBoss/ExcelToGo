"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { colToLetters } from "@/lib/sheet";
import { cellRef } from "@/lib/formulaEngine/address";
import { FormulaError } from "@/lib/formulaEngine/types";
import { normalizeSelection, singleCellSelection } from "@/types/sheet-ui";
import { selectActiveSelection, selectActiveSheet, useComputedSheet, useSheetStore } from "@/store/sheetStore";
import { FORMULA_BY_ID } from "@/lib/formulaCatalog";
import clsx from "clsx";

const ROW_HEADER_WIDTH = 48;
const COL_WIDTH = 112;
const ROW_HEIGHT = 32;

export default function SpreadsheetGrid() {
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
  const { values, display } = useComputedSheet();
  const rawAt = useCallback((row: number, col: number) => sheet.cells[row]?.[col] ?? "", [sheet]);

  const onSelectionChange = setSelection;
  const onCellCommit = commitCell;
  const onFormulaDrop = (row: number, col: number, formulaId: string) => {
    const def = FORMULA_BY_ID[formulaId];
    if (!def) return;
    setSelection(singleCellSelection(row, col));
    openFormulaPanel(def, row, col);
  };

  const [editing, setEditing] = useState<{ row: number; col: number; value: string } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ row: number; col: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ type: "row" | "col"; index: number; x: number; y: number } | null>(
    null
  );
  const isSelecting = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing?.row, editing?.col]);

  const startEdit = useCallback(
    (row: number, col: number, initialValue?: string) => {
      setEditing({ row, col, value: initialValue ?? rawAt(row, col) });
    },
    [rawAt]
  );

  const commitEdit = useCallback(() => {
    if (!editing) return;
    onCellCommit(editing.row, editing.col, editing.value);
    setEditing(null);
  }, [editing, onCellCommit]);

  const handleMouseDown = (row: number, col: number, shiftKey: boolean) => {
    if (editing && (editing.row !== row || editing.col !== col)) commitEdit();
    isSelecting.current = true;
    if (shiftKey) {
      onSelectionChange(normalizeSelection({ row: selection.anchorRow, col: selection.anchorCol }, { row, col }));
    } else {
      onSelectionChange(singleCellSelection(row, col));
    }
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (!isSelecting.current) return;
    onSelectionChange(normalizeSelection({ row: selection.anchorRow, col: selection.anchorCol }, { row, col }));
  };

  const selectWholeRow = (row: number) =>
    onSelectionChange({ anchorRow: row, anchorCol: 0, startRow: row, startCol: 0, endRow: row, endCol: sheet.cols - 1 });
  const selectWholeColumn = (col: number) =>
    onSelectionChange({ anchorRow: 0, anchorCol: col, startRow: 0, startCol: col, endRow: sheet.rows - 1, endCol: col });

  const openHeaderMenu = (e: React.MouseEvent, type: "row" | "col", index: number) => {
    e.preventDefault();
    if (type === "row") selectWholeRow(index);
    else selectWholeColumn(index);
    setContextMenu({ type, index, x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

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
      onSelectionChange(singleCellSelection(nr, nc));
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
        clearSelection();
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
                {colToLetters(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: sheet.rows }, (_, r) => (
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
                      const formulaId = e.dataTransfer.getData("text/formula-id");
                      if (formulaId) {
                        onSelectionChange(singleCellSelection(r, c));
                        onFormulaDrop(r, c, formulaId);
                      }
                    }}
                    className={clsx(
                      "relative border-b border-r border-zinc-200 px-2 text-sm outline-none",
                      isActive(r, c) && "ring-2 ring-inset ring-blue-500",
                      !isActive(r, c) && isInSelection(r, c) && "bg-blue-50",
                      dragOverCell?.row === r && dragOverCell?.col === c && "bg-emerald-100 ring-2 ring-emerald-400",
                      isInClipboard(r, c) && (clipboard?.cut ? "outline-dashed outline-2 outline-orange-400 -outline-offset-2" : "outline-dashed outline-2 outline-blue-400 -outline-offset-2"),
                      isErr && "text-red-600"
                    )}
                    style={{ width: COL_WIDTH, minWidth: COL_WIDTH, height: ROW_HEIGHT, maxWidth: COL_WIDTH }}
                    title={cellRef(r, c)}
                  >
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
                            onSelectionChange(singleCellSelection(Math.min(r + 1, sheet.rows - 1), c));
                          } else if (e.key === "Escape") {
                            setEditing(null);
                          } else if (e.key === "Tab") {
                            e.preventDefault();
                            commitEdit();
                            onSelectionChange(singleCellSelection(r, Math.min(c + 1, sheet.cols - 1)));
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
                  setContextMenu(null);
                }}
                className="block w-full px-3 py-1.5 text-left hover:bg-zinc-50"
              >
                แทรกแถวด้านบน
              </button>
              <button
                onClick={() => {
                  deleteSelectedRow();
                  setContextMenu(null);
                }}
                className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
              >
                ลบแถวนี้
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  insertColumnAtSelection();
                  setContextMenu(null);
                }}
                className="block w-full px-3 py-1.5 text-left hover:bg-zinc-50"
              >
                แทรกคอลัมน์ด้านซ้าย
              </button>
              <button
                onClick={() => {
                  deleteSelectedColumn();
                  setContextMenu(null);
                }}
                className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
              >
                ลบคอลัมน์นี้
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
