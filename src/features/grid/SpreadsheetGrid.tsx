"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { colToLetters } from "@/lib/sheet";
import { cellRef } from "@/lib/formulaEngine/address";
import { FormulaError } from "@/lib/formulaEngine/types";
import { normalizeSelection, singleCellSelection } from "@/types/sheet-ui";
import { useComputedSheet, useSheetStore } from "@/store/sheetStore";
import { FORMULA_BY_ID } from "@/lib/formulaCatalog";
import clsx from "clsx";

const ROW_HEADER_WIDTH = 48;
const COL_WIDTH = 112;
const ROW_HEIGHT = 32;

export default function SpreadsheetGrid() {
  const sheet = useSheetStore((s) => s.sheet);
  const selection = useSheetStore((s) => s.selection);
  const setSelection = useSheetStore((s) => s.setSelection);
  const commitCell = useSheetStore((s) => s.setCellRaw);
  const openFormulaPanel = useSheetStore((s) => s.openFormulaPanel);
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
        onCellCommit(row, col, "");
        e.preventDefault();
        break;
      case "F2":
        startEdit(row, col);
        e.preventDefault();
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

  return (
    <div className="relative h-full overflow-auto rounded-lg border border-zinc-200 bg-white" tabIndex={-1}>
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
                className={clsx(
                  "sticky top-0 z-20 border-b border-r border-zinc-200 text-xs font-semibold text-zinc-600",
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
                className={clsx(
                  "sticky left-0 z-10 border-b border-r border-zinc-200 text-xs font-semibold text-zinc-600",
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
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap leading-8">
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
    </div>
  );
}
