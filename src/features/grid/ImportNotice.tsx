// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { FileCheck2, Undo2, X } from "lucide-react";
import { undoSheet, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";

/**
 * Says what a file open just did, with the way back beside it.
 *
 * It used to say only "file imported, 1 sheet", after quietly replacing everything that was open.
 * Undo always worked — one step takes the whole open back — but nothing said so, and the person who
 * got their work back in the blind test did it by luck. So the notice names what happened to the
 * work that was there and puts undo one press away.
 */
export default function ImportNotice() {
  const t = useT();
  const notice = useSheetStore((s) => s.importNotice);
  const dismiss = useSheetStore((s) => s.dismissImportNotice);
  if (!notice) return null;

  return (
    <div role="status" className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-950">
      <FileCheck2 size={14} className="shrink-0" aria-hidden />
      <p className="flex-1 leading-relaxed">
        {notice.mode === "append" ? t.importChoice.doneAppend(notice.sheets) : t.importChoice.doneReplace(notice.sheets)}
      </p>
      <button
        onClick={() => {
          undoSheet();
          dismiss();
        }}
        className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-700 px-3 font-medium text-emerald-800 hover:bg-emerald-100 sm:min-h-0 sm:py-1.5"
      >
        <Undo2 size={14} aria-hidden /> {t.importChoice.undo}
      </button>
      <button
        onClick={dismiss}
        aria-label={t.importChoice.dismiss}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-emerald-800 hover:bg-emerald-100 sm:min-h-0 sm:min-w-0 sm:p-1.5"
      >
        <X size={14} />
      </button>
    </div>
  );
}
