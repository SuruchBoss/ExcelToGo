"use client";

import { RefreshCw, Unlink } from "lucide-react";
import { selectPivotStatus, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";

/**
 * Tells a pivot sheet when the numbers behind it have moved, and offers to ask the question again.
 *
 * A pivot is deliberately not live — the result is an ordinary sheet you can sort, chart and edit,
 * and one that rewrote itself whenever a source cell changed would throw that away inside someone
 * else's undo history. But "not live" used to mean the sheet had no idea it was out of date, and
 * rebuilding it meant going back, re-selecting the range and re-picking every field.
 *
 * So the sheet says so, and one button does the rest. Nothing is shown while it is up to date: a
 * banner that is always there is a banner nobody reads.
 */
export default function PivotNotice() {
  const t = useT();
  const status = useSheetStore(selectPivotStatus);
  const refreshPivot = useSheetStore((s) => s.refreshPivot);

  if (status === null || status === "fresh") return null;

  const orphaned = status === "orphaned";
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900"
    >
      {orphaned ? <Unlink size={14} className="shrink-0" /> : <RefreshCw size={14} className="shrink-0" />}
      <p className="flex-1 leading-relaxed">{orphaned ? t.pivot.sourceGone : t.pivot.sourceChanged}</p>
      {!orphaned && (
        <button
          onClick={() => refreshPivot()}
          className="min-h-11 shrink-0 whitespace-nowrap rounded-md bg-amber-700 px-3 font-medium text-white hover:bg-amber-800 sm:min-h-0 sm:py-1.5"
        >
          {t.pivot.refresh}
        </button>
      )}
    </div>
  );
}
