// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cellRef } from "@/lib/formulaEngine/address";
import { useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import { useCoarsePointer } from "@/features/grid/SelectionHandle";

/**
 * The formula form folded down while a range is picked on a phone (#138).
 *
 * Below 1024px the form is a sheet over the grid, and ⌖ used to leave it there: every row stayed
 * covered, the dim backdrop took the taps, and a range could not be picked on a phone at all. Now
 * ⌖ folds the form into this bar at the bottom — the grid above it is live, a tap picks a cell and
 * the blue dot widens it, and the field follows the selection as it already did with a mouse
 * (`setSelection` in the store). "Use" opens the form again with the range in; "Back" (or Escape)
 * opens it as it was before ⌖.
 */
export default function PickingBar() {
  const t = useT();
  const coarse = useCoarsePointer();
  const pending = useSheetStore((s) => s.pending);
  const updatePending = useSheetStore((s) => s.updatePending);
  // What the field held when ⌖ was pressed, for Back.
  const [before] = useState(() => (pending?.pickingKey ? pending.values[pending.pickingKey] ?? "" : ""));

  const key = pending?.pickingKey ?? null;
  useEffect(() => {
    if (!key) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      const current = useSheetStore.getState().pending;
      if (current) updatePending({ ...current, values: { ...current.values, [key]: before }, pickingKey: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, before, updatePending]);

  if (!pending || !key) return null;
  const param = pending.def.params.find((p) => p.key === key);
  const value = pending.values[key] ?? "";
  const back = () => updatePending({ ...pending, values: { ...pending.values, [key]: before }, pickingKey: null });
  const use = () => updatePending({ ...pending, pickingKey: null });

  return (
    <div
      role="region"
      aria-label={t.paramPanel.pickingBarLabel}
      className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-zinc-200 bg-white px-3 pb-2 pt-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-zinc-800">
          {pending.def.name} · {param?.label ?? key}{" "}
          <span className="font-normal text-zinc-600">→ {cellRef(pending.anchorRow, pending.anchorCol)}</span>
        </span>
        <span
          aria-live="polite"
          className={
            value
              ? "shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-sm font-semibold text-blue-800"
              : "shrink-0 text-xs text-zinc-600"
          }
        >
          {value || t.paramPanel.pickNothing}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-emerald-800">{coarse ? t.paramPanel.pickingHintTouch : t.paramPanel.pickingHint}</p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={back}
          className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {t.paramPanel.pickBack}
        </button>
        <button
          onClick={use}
          disabled={!value}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
        >
          <Check size={16} aria-hidden /> {t.paramPanel.pickUse(value || "…")}
        </button>
      </div>
    </div>
  );
}
