"use client";

import { RefObject, useLayoutEffect, useRef } from "react";
import { Pencil, RefreshCw, X } from "lucide-react";
import { LiveBlock } from "@/lib/liveBlocks";
import { useT } from "@/i18n";

interface Props {
  block: LiveBlock;
  sourceName: string;
  refreshSec: number;
  /** The grid's scroll container — the toolbar is positioned inside it so it scrolls with the cells. */
  containerRef: RefObject<HTMLDivElement | null>;
  onRefresh: () => void;
  onChange: () => void;
  onRemove: () => void;
}

/** Floats just above a placed block when it's selected, answering "what is this green area and how
 *  do I get rid of it" right where the user is looking, instead of sending them to the side panel. */
export default function LiveBlockToolbar({ block, sourceName, refreshSec, containerRef, onRefresh, onChange, onRemove }: Props) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  // Runs after every render so the toolbar follows the block as live data resizes it.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const el = ref.current;
    if (!container || !el) return;
    const cell = container.querySelector<HTMLElement>(`td[data-row="${block.anchorRow}"][data-col="${block.anchorCol}"]`);
    if (!cell) return;
    const maxLeft = container.scrollLeft + container.clientWidth - el.offsetWidth - 8;
    el.style.left = `${Math.max(container.scrollLeft + 4, Math.min(cell.offsetLeft, maxLeft))}px`;

    // Above the block by default, but a block starting on row 1 has no room there — the toolbar
    // would sit on the sticky column headers and hide the letters the user navigates by. In that
    // case it goes under the block instead.
    const headerHeight = container.querySelector<HTMLElement>("thead")?.offsetHeight ?? 0;
    const above = cell.offsetTop - el.offsetHeight - 4;
    if (above >= headerHeight) {
      el.style.top = `${above}px`;
      return;
    }
    const lastCell = container.querySelector<HTMLElement>(
      `td[data-row="${block.anchorRow + Math.max(1, block.rows) - 1}"][data-col="${block.anchorCol}"]`
    );
    const bottom = lastCell ? lastCell.offsetTop + lastCell.offsetHeight : cell.offsetTop + cell.offsetHeight;
    el.style.top = `${bottom + 4}px`;
  });

  const size = block.kind === "table" ? t.data.blockTool.rows(Math.max(0, block.rows - 1)) : t.data.blockTool.singleValue;

  return (
    <div
      ref={ref}
      className="absolute z-20 flex items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 py-1 pl-2.5 pr-1.5 text-xs text-white shadow-lg"
    >
      <span>
        <b className="font-semibold">{sourceName}</b>
        <span className="opacity-75">
          {" "}
          · {size} · {t.data.blockTool.every(refreshSec)}
        </span>
      </span>
      <button onClick={onRefresh} className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-white/25">
        <RefreshCw size={12} /> {t.data.blockTool.refresh}
      </button>
      <button onClick={onChange} className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-white/25">
        <Pencil size={12} /> {t.data.blockTool.change}
      </button>
      <button onClick={onRemove} className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-white/25">
        <X size={12} /> {t.data.blockTool.remove}
      </button>
    </div>
  );
}
