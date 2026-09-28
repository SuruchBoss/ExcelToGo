// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ClipboardPaste, Columns3, Copy, Eraser, Rows3, Scissors, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useT } from "@/i18n";
import { formatKey, isAppleKeyboard } from "@/lib/keyboardShortcuts";

export interface CellMenuActions {
  cut: () => void;
  copy: () => void;
  paste: () => void;
  canPaste: boolean;
  insertRow: () => void;
  insertColumn: () => void;
  deleteRow: () => void;
  deleteColumn: () => void;
  clear: () => void;
  /** Copies the selection's top row down it — on the touch bar, and so here for when that bar is
   *  folded away on a short screen (#129). */
  fillDown: () => void;
  canFillDown: boolean;
}

/**
 * Right-click on a cell: the handful of things a person reaches for there in Excel.
 *
 * Until this, right-click on a cell gave the browser's own menu — Back, Reload, Inspect — and the
 * app's menu lived only on the row and column headers, where nobody from Excel looks for it first.
 * Every entry is an action the app already had behind a shortcut or a toolbar button; the menu
 * shows the shortcut beside it, so using the menu is also how the shortcut gets learned.
 *
 * A real menu to assistive technology: `role="menu"`, arrow keys move, Home/End jump, Escape closes
 * and puts focus back on the grid. It also opens from the keyboard (the Menu key or Shift+F10),
 * at the cell, for anyone who cannot right-click at all — and from a long press on a touch screen,
 * where it holds what the touch bar holds when a short screen folds that bar away (#129).
 */
export default function CellContextMenu({
  x,
  y,
  actions,
  onClose,
}: {
  x: number;
  y: number;
  actions: CellMenuActions;
  onClose: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const apple = useMemo(
    () => (typeof navigator === "undefined" ? false : isAppleKeyboard(navigator.platform, navigator.userAgent)),
    []
  );
  const key = (k: string) => `${formatKey("Mod", apple)}${apple ? "" : "+"}${k}`;

  const items = () => [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [])];

  // Opened near the bottom or right edge, it flips to stay on screen rather than hanging off it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      top: Math.max(8, y + height > window.innerHeight - 8 ? y - height : y),
    });
  }, [x, y]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    items()[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onScroll = () => onClose();
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("resize", onScroll);
      opener?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const go = (i: number) => {
      e.preventDefault();
      list[(i + list.length) % list.length]?.focus();
    };
    e.stopPropagation();
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(list.length - 1);
    else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      onClose();
    }
  };

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const item = "flex w-full items-center gap-2.5 px-3 py-1.5 pointer-coarse:py-2.5 text-left text-sm outline-none focus:bg-zinc-100 hover:bg-zinc-50 disabled:text-zinc-400 disabled:hover:bg-transparent";
  const hint = "ml-auto pl-4 text-xs text-zinc-600";
  const rule = <div role="separator" className="my-1 h-px bg-zinc-200" />;

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={t.grid.cellMenu}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 w-60 rounded-lg border border-zinc-200 bg-white py-1 text-zinc-700 shadow-xl"
      style={pos}
    >
      <button role="menuitem" onClick={run(actions.cut)} className={item}>
        <Scissors size={15} aria-hidden /> {t.touchBar.cut} <span className={hint}>{key("X")}</span>
      </button>
      <button role="menuitem" onClick={run(actions.copy)} className={item}>
        <Copy size={15} aria-hidden /> {t.touchBar.copy} <span className={hint}>{key("C")}</span>
      </button>
      <button role="menuitem" onClick={run(actions.paste)} disabled={!actions.canPaste} className={item}>
        <ClipboardPaste size={15} aria-hidden /> {t.touchBar.paste} <span className={hint}>{key("V")}</span>
      </button>
      <button role="menuitem" onClick={run(actions.fillDown)} disabled={!actions.canFillDown} className={item}>
        <ArrowDownToLine size={15} aria-hidden /> {t.touchBar.fillDown} <span className={hint}>{key("D")}</span>
      </button>
      {rule}
      <button role="menuitem" onClick={run(actions.insertRow)} className={item}>
        <Rows3 size={15} aria-hidden /> {t.grid.insertRowAbove}
      </button>
      <button role="menuitem" onClick={run(actions.insertColumn)} className={item}>
        <Columns3 size={15} aria-hidden /> {t.grid.insertColumnLeft}
      </button>
      {rule}
      <button role="menuitem" onClick={run(actions.clear)} className={item}>
        <Eraser size={15} aria-hidden /> {t.touchBar.clear} <span className={hint}>{apple ? "⌫" : "Delete"}</span>
      </button>
      <button role="menuitem" onClick={run(actions.deleteRow)} className={clsx(item, "text-red-700")}>
        <Trash2 size={15} aria-hidden /> {t.grid.deleteRow}
      </button>
      <button role="menuitem" onClick={run(actions.deleteColumn)} className={clsx(item, "text-red-700")}>
        <Trash2 size={15} aria-hidden /> {t.grid.deleteColumn}
      </button>
    </div>
  );
}
