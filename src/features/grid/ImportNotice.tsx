// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { FileCheck2, Undo2, X } from "lucide-react";
import { undoSheet, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";

/** Long enough to read twice and reach for Undo; the top bar's undo stays after it goes. */
const SHOWN_FOR_MS = 10_000;

/**
 * Says what a file open just did, with the way back beside it.
 *
 * It used to say only "file imported, 1 sheet", after quietly replacing everything that was open.
 * Undo always worked — one step takes the whole open back — but nothing said so, and the person who
 * got their work back in the blind test did it by luck. So the notice names what happened to the
 * work that was there and puts undo one press away.
 *
 * A toast over the foot of the grid, not a band above it (#129): as a band it pushed the grid down,
 * and with the storage notice over it left ten rows on a phone. It goes after ten seconds or at the
 * next edit — after that, "undo" would take back the edit rather than the file — and the undo on the
 * top bar does the same job either way. The timer waits while a button in it has focus or a pointer.
 *
 * Only its buttons take a touch: a swipe that starts on its words reaches the grid under it.
 */
export default function ImportNotice() {
  const t = useT();
  const notice = useSheetStore((s) => s.importNotice);
  const dismiss = useSheetStore((s) => s.dismissImportNotice);
  const history = useStore(useSheetStore.temporal, (s) => s.pastStates);
  const [held, setHeld] = useState(false);

  // The history as the file left it. Declared before the effect below so that, on the render where
  // the file lands, it is taken first and the comparison sees no change.
  const opened = useRef(history);
  useEffect(() => {
    opened.current = useSheetStore.temporal.getState().pastStates;
  }, [notice]);
  useEffect(() => {
    if (notice && history !== opened.current) dismiss();
  }, [history, notice, dismiss]);

  useEffect(() => {
    if (!notice || held) return;
    const timer = window.setTimeout(dismiss, SHOWN_FOR_MS);
    return () => window.clearTimeout(timer);
  }, [notice, held, dismiss]);

  if (!notice) return null;

  const hold = {
    onPointerEnter: () => setHeld(true),
    onPointerLeave: () => setHeld(false),
    onFocus: () => setHeld(true),
    onBlur: () => setHeld(false),
  };
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex justify-center">
      <div
        role="status"
        // Wraps rather than squeezing: on a narrow screen the words keep a line of their own and the
        // buttons go under them, instead of one word to a line down the whole grid.
        className="flex max-w-md flex-wrap items-center justify-end gap-x-2 gap-y-0.5 rounded-lg border border-emerald-300 bg-emerald-50 py-1 pl-3 pr-1 text-xs text-emerald-950 shadow-lg"
      >
        <FileCheck2 size={14} className="shrink-0" aria-hidden />
        <p className="min-w-[8rem] flex-1 leading-snug">
          {notice.mode === "append" ? t.importChoice.doneAppend(notice.sheets) : t.importChoice.doneReplace(notice.sheets)}
        </p>
        <button
          {...hold}
          onClick={() => {
            undoSheet();
            dismiss();
          }}
          className="pointer-events-auto flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-700 bg-white px-3 font-medium text-emerald-800 hover:bg-emerald-100 sm:min-h-0 sm:py-1.5"
        >
          <Undo2 size={14} aria-hidden /> {t.importChoice.undo}
        </button>
        <button
          {...hold}
          onClick={dismiss}
          aria-label={t.importChoice.dismiss}
          className="pointer-events-auto flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-emerald-800 hover:bg-emerald-100 sm:min-h-0 sm:min-w-0 sm:p-1.5"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
