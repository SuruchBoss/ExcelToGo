// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { ArrowDownToLine, ClipboardPaste, Copy, Eraser, Scissors } from "lucide-react";
import { selectActiveSelection, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import { useCoarsePointer } from "./SelectionHandle";
import { useKeyboardOpen } from "@/features/toolbar/useKeyboardOpen";
import { usePointingActive } from "./PointingBar";

/**
 * Copy, cut, paste, fill down and clear, for a finger.
 *
 * With a mouse these are Ctrl+C, Ctrl+V, Ctrl+D and Delete. On a phone there is no keyboard to
 * press them on and no right-click, so in the blind test copying "yes" down ten rows could not be
 * done at all. The bar is the shortcut row a phone never had: a row of its own between the grid and
 * the sheet tabs (floating, it sat on the tabs), shown only where the pointer is coarse, and gone
 * while the keyboard is up or a panel is open — the two times it would cover what someone is using.
 *
 * The clipboard is the app's own, the same one Ctrl+C fills, so a copy here pastes there and back.
 */
export default function TouchActionBar() {
  const t = useT();
  const coarse = useCoarsePointer();
  const selection = useSheetStore(selectActiveSelection);
  const panelOpen = useSheetStore((s) => s.sidebarMode !== "none" || s.pending !== null);
  const hasClipboard = useSheetStore((s) => s.clipboard !== null);
  const copySelection = useSheetStore((s) => s.copySelection);
  const cutSelection = useSheetStore((s) => s.cutSelection);
  const pasteAtSelection = useSheetStore((s) => s.pasteAtSelection);
  const fillWithinSelection = useSheetStore((s) => s.fillWithinSelection);
  const clearSelection = useSheetStore((s) => s.clearSelection);
  const keyboardOpen = useKeyboardOpen();
  // A formula pointed at has the pointing bar in this place, even with no keyboard up (#99).
  const pointing = usePointingActive();

  if (!coarse || keyboardOpen || panelOpen || pointing) return null;

  const multiRow = selection.endRow > selection.startRow;
  const button =
    "flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:text-zinc-400";

  return (
    <div
      role="toolbar"
      aria-label={t.touchBar.label}
      // Folded on a short screen: its actions are in the cell menu, a long press away (#129).
      className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-t border-zinc-200 bg-white px-1 max-lg:short:hidden"
    >
      <button onClick={copySelection} className={button}>
        <Copy size={16} aria-hidden /> {t.touchBar.copy}
      </button>
      <button onClick={cutSelection} className={button}>
        <Scissors size={16} aria-hidden /> {t.touchBar.cut}
      </button>
      <button onClick={() => pasteAtSelection()} disabled={!hasClipboard} className={button}>
        <ClipboardPaste size={16} aria-hidden /> {t.touchBar.paste}
      </button>
      {/* Fill down needs somewhere to fill: the top row of a selection at least two rows tall. */}
      <button onClick={() => fillWithinSelection("down")} disabled={!multiRow} className={button}>
        <ArrowDownToLine size={16} aria-hidden /> {t.touchBar.fillDown}
      </button>
      <button onClick={clearSelection} className={button}>
        <Eraser size={16} aria-hidden /> {t.touchBar.clear}
      </button>
    </div>
  );
}
