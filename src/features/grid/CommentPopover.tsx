"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquareText, Trash2 } from "lucide-react";
import { cellRef } from "@/lib/formulaEngine/address";
import { useT } from "@/i18n";
import { useClickAway } from "./useClickAway";

/**
 * Writes the note on one cell.
 *
 * Opened from the format bar for whichever cell is selected, rather than from a right-click: the
 * row and column headers already own the context menu, and on touch there is no right-click at all,
 * which is where a comments feature reachable only that way would simply not exist.
 */
export default function CommentPopover({
  row,
  col,
  value,
  anchor,
  onSave,
  onClose,
}: {
  row: number;
  col: number;
  value: string;
  /** Where the box is pinned, worked out from the button that opened it. */
  anchor: { x: number; y: number };
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [text, setText] = useState(value);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useClickAway(true, onClose);

  useEffect(() => {
    areaRef.current?.focus();
    areaRef.current?.select();
  }, []);

  const commit = () => {
    onSave(text);
    onClose();
  };

  return (
    <div
      // useClickAway closes on any click in the window, so the box has to stop its own from
      // reaching it — the same contract the filter popover and header menu work under.
      onClick={(e) => e.stopPropagation()}
      className="fixed z-50 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl"
      style={{ left: anchor.x, top: anchor.y }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <MessageSquareText size={14} className="text-amber-600" />
        <span className="text-xs font-semibold text-zinc-800">{t.comments.titleFor(cellRef(row, col))}</span>
      </div>
      <textarea
        ref={areaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter inserts a newline, as in any note field; the shortcut that saves is the one the
          // rest of the app uses to mean "done with this box".
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
        }}
        rows={4}
        placeholder={t.comments.placeholder}
        className="w-full resize-none rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
      />
      <div className="mt-2 flex items-center gap-1.5">
        <button
          onClick={commit}
          className="flex min-h-9 flex-1 items-center justify-center rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 sm:min-h-0 sm:py-1.5"
        >
          {t.comments.save}
        </button>
        {value !== "" && (
          <button
            onClick={() => {
              onSave("");
              onClose();
            }}
            title={t.comments.remove}
            className="flex min-h-9 items-center justify-center rounded-md border border-zinc-300 px-2 text-zinc-500 hover:bg-red-50 hover:text-red-700 sm:min-h-0 sm:py-1.5"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-400">{t.comments.hint}</p>
    </div>
  );
}
