// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useId, useRef } from "react";
import { FilePlus2, Replace, X } from "lucide-react";
import { useT } from "@/i18n";
import { useDialogKeys } from "@/features/a11y/useDialogKeys";

/**
 * Asked before a file is opened over work that is already there.
 *
 * Opening a file used to replace the whole workbook without a word. In the blind test two of three
 * people lost work to it; one got it back by pressing undo on a hunch. So the question is asked, and
 * the safe answer — keep what is open and add the file after it — is the first one and the one that
 * has focus, so Enter does the harmless thing. Replacing is still one press away, because sometimes
 * that is what someone wants, and it says plainly what it will do.
 */
export default function ImportChoiceDialog({
  fileName,
  sheets,
  onChoose,
  onCancel,
}: {
  fileName: string;
  /** How many tabs are open now — the thing a replace would take away. */
  sheets: number;
  onChoose: (mode: "append" | "replace") => void;
  onCancel: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const safeRef = useRef<HTMLButtonElement>(null);

  // Escape cancels, Tab stays inside, and the safe choice has focus from the start.
  useDialogKeys(panelRef, onCancel, safeRef);

  const option =
    "flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div onClick={onCancel} aria-hidden className="absolute inset-0 bg-zinc-900/40" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-dvh w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-xl sm:pb-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-zinc-900">
              {t.importChoice.title}
            </h2>
            <p className="mt-0.5 break-all text-sm text-zinc-600">{fileName}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label={t.importChoice.cancel}
            className="-mr-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-zinc-700">{t.importChoice.body(sheets)}</p>

        <div className="mt-4 flex flex-col gap-2">
          <button ref={safeRef} onClick={() => onChoose("append")} className={`${option} border-emerald-600 bg-emerald-50 hover:bg-emerald-100`}>
            <FilePlus2 size={20} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-emerald-900">{t.importChoice.append}</span>
              <span className="block text-xs text-zinc-700">{t.importChoice.appendHint}</span>
            </span>
          </button>
          <button onClick={() => onChoose("replace")} className={`${option} border-zinc-300 hover:bg-zinc-50`}>
            <Replace size={20} className="mt-0.5 shrink-0 text-red-700" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-zinc-900">{t.importChoice.replace}</span>
              <span className="block text-xs text-zinc-700">{t.importChoice.replaceHint(sheets)}</span>
            </span>
          </button>
          <button onClick={onCancel} className="min-h-11 rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
            {t.importChoice.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
