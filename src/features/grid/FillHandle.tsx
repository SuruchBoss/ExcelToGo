// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cellAt, columnLeft, columnWidth, rowHeight, rowTop } from "@/lib/gridGeometry";
import { fillTargetFor, type FillTarget } from "@/lib/fillSeries";
import { SheetModel } from "@/lib/sheet";
import { SelectionRect } from "@/types/sheet-ui";
import { useT } from "@/i18n";
import { useCoarsePointer } from "./SelectionHandle";

/**
 * Excel's fill handle: the little square on the corner of the selection that continues it.
 *
 * The sibling of `SelectionHandle`, and the reason that one is touch-only. Its comment has said for
 * a while that on a mouse the grip "would sit under the cursor looking like Excel's fill handle and
 * doing something else entirely" — which was true, and left the single most-used gesture in any
 * spreadsheet doing nothing at all on the device most people would try it on.
 *
 * Split by pointer type rather than shown to everyone: a finger cannot sweep a range any other way,
 * so touch keeps the grip for selecting; a mouse can sweep a range by dragging, so its corner is
 * free to mean what it means everywhere else.
 *
 * The preview is the whole interaction. Committing on release rather than filling live matters for
 * undo as much as for nerves — one drag is one step back, not one per cell it passed over.
 */
export default function FillHandle({
  sheet,
  selection,
  hiddenRows,
  scrollRef,
  onFill,
}: {
  sheet: SheetModel;
  selection: SelectionRect;
  hiddenRows: ReadonlySet<number>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onFill: (row: number, col: number) => void;
}) {
  const t = useT();
  const coarse = useCoarsePointer();
  const [preview, setPreview] = useState<FillTarget | null>(null);
  const dragging = useRef(false);

  const cellUnder = useCallback(
    (clientX: number, clientY: number) => {
      const container = scrollRef.current;
      if (!container) return null;
      const box = container.getBoundingClientRect();
      return cellAt(sheet, clientX - box.left + container.scrollLeft, clientY - box.top + container.scrollTop, hiddenRows);
    },
    [sheet, hiddenRows, scrollRef]
  );

  // A drag that ends outside the window still ends. Without this the handle stays armed and the
  // next click anywhere fills something.
  useEffect(() => {
    if (!preview && !dragging.current) return;
    const cancel = () => {
      dragging.current = false;
      setPreview(null);
    };
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, [preview]);

  if (coarse) return null;

  const source: FillTarget = {
    startRow: selection.startRow,
    startCol: selection.startCol,
    endRow: selection.endRow,
    endCol: selection.endCol,
  };
  const left = columnLeft(sheet, selection.endCol) + columnWidth(sheet, selection.endCol);
  const top = rowTop(sheet, selection.endRow, hiddenRows) + rowHeight(sheet, selection.endRow);

  const previewBox = preview
    ? {
        left: columnLeft(sheet, preview.startCol),
        top: rowTop(sheet, preview.startRow, hiddenRows),
        width:
          columnLeft(sheet, preview.endCol) + columnWidth(sheet, preview.endCol) - columnLeft(sheet, preview.startCol),
        height:
          rowTop(sheet, preview.endRow, hiddenRows) + rowHeight(sheet, preview.endRow) - rowTop(sheet, preview.startRow, hiddenRows),
      }
    : null;

  return (
    <>
      {previewBox && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-20 border-2 border-dashed border-blue-500 bg-blue-500/5"
          style={previewBox}
        />
      )}
      <div
        role="presentation"
        title={t.grid.fillHandle}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = true;
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          const at = cellUnder(e.clientX, e.clientY);
          setPreview(at ? fillTargetFor(source, at.row, at.col) : null);
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          dragging.current = false;
          const at = cellUnder(e.clientX, e.clientY);
          setPreview(null);
          if (at) onFill(at.row, at.col);
        }}
        // Offset by half its own size so it straddles the corner the way Excel's does, and sits
        // over the selection ring rather than beside it.
        style={{ left: left - 4, top: top - 4 }}
        className="absolute z-30 h-2 w-2 cursor-crosshair rounded-[1px] border border-white bg-blue-600"
      />
    </>
  );
}
