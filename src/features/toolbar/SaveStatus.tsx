// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CircleCheck, FileDown, TriangleAlert } from "lucide-react";
import clsx from "clsx";
import { getSaveStatus, subscribeSaveStatus } from "@/lib/saveHealth";
import { hasKeptCopy, subscribeKeptCopy } from "@/lib/keptCopy";
import { selectHasWork, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";

/**
 * Where a document app says it saved: beside the name, as a status — and, since #129, the place
 * the "saved in this browser only" warning lives once it has been read.
 *
 * That warning was a three-line band over the grid on every visit until dismissed; stacked with the
 * import message it left ten rows on a phone. Now it shows as one line in the visit of the first
 * edit (`StorageNotice`), and from then on it is this: a tick, an amber dot until a copy of the work
 * has been exported, and the whole text one press away with the export beside it.
 *
 * A tick says it is done; amber and different words when the browser refused the last save. The
 * word only from 2xl: below that the row overflowed a 1366px laptop in English. The word stays for
 * a screen reader, in the button's name.
 */
export default function SaveStatus() {
  const t = useT();
  const status = useSyncExternalStore(subscribeSaveStatus, getSaveStatus, () => "ok" as const);
  // Nothing on the server knows, and a dot flashing at everyone who has exported would be worse
  // than one that appears a moment late.
  const kept = useSyncExternalStore(subscribeKeptCopy, hasKeptCopy, () => true);
  const hasWork = useSheetStore(selectHasWork);
  const exportXlsx = useSheetStore((s) => s.exportXlsx);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const ok = status === "ok";
  const dot = ok && hasWork && !kept;
  const word = ok ? t.toolbar.autosaveLabel : t.toolbar.autosaveFailed;

  useEffect(() => {
    if (!anchor) return;
    popoverRef.current?.querySelector<HTMLElement>("button")?.focus();
    const close = () => {
      setAnchor(null);
      buttonRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!popoverRef.current?.contains(target) && !buttonRef.current?.contains(target)) setAnchor(null);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [anchor]);

  const toggle = () => {
    if (anchor) return setAnchor(null);
    const r = buttonRef.current!.getBoundingClientRect();
    // `fixed`, placed from the button: the top bar scrolls sideways, and a popover inside it would
    // be clipped by that overflow. Kept on screen at 360px.
    setAnchor({ x: Math.max(8, Math.min(r.left, window.innerWidth - 288 - 8)), y: r.bottom + 6 });
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-expanded={anchor !== null}
        aria-haspopup="dialog"
        aria-label={dot ? `${word} · ${t.storageNotice.noCopyYet}` : word}
        title={ok ? t.toolbar.autosaveTitle : t.toolbar.autosaveFailed}
        // Below 360px (a phone at 200% zoom) it goes to the end of the row, after the language: the
        // row scrolls there, and what must be on screen before any scroll is Undo — a phone has no
        // Ctrl+Z to fall back on (PO, #129).
        className={clsx(
          // From 1024px it takes the old status's footprint exactly (a 13px icon, no padding): the
          // row was measured to the pixel at 1366 and 1440 in English, and 14px more made it scroll.
          "relative -ml-1 mr-1 flex min-h-11 min-w-11 max-[359px]:order-1 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md px-1.5 text-xs hover:bg-zinc-100 lg:mr-2 lg:min-h-0 lg:min-w-0 lg:px-0 lg:py-1",
          ok ? "text-zinc-500" : "font-medium text-amber-800"
        )}
      >
        <span className="relative">
          {ok ? (
            <CircleCheck size={15} aria-hidden className="text-emerald-600 lg:size-[13px]" />
          ) : (
            <TriangleAlert size={15} aria-hidden className="lg:size-[13px]" />
          )}
          {dot && <span aria-hidden className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />}
        </span>
        <span aria-hidden className="hidden 2xl:inline">
          {word}
        </span>
      </button>
      {anchor && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={t.storageNotice.title}
          className="fixed z-50 w-72 rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-700 shadow-xl"
          style={{ left: anchor.x, top: anchor.y }}
        >
          <p className="mb-1 text-sm font-semibold text-zinc-900">{ok ? t.storageNotice.title : t.toolbar.autosaveFailed}</p>
          <p>{ok ? t.storageNotice.text : status === "full" ? t.saveFailed.full : t.saveFailed.blocked}</p>
          {dot && <p className="mt-1.5 font-medium text-amber-800">{t.storageNotice.noCopyYet}</p>}
          <button
            onClick={() => {
              setAnchor(null);
              exportXlsx();
            }}
            className="mt-2.5 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800"
          >
            <FileDown size={15} aria-hidden /> {t.toolbar.exportExcel}
          </button>
        </div>
      )}
    </>
  );
}
