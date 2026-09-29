// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { cellRef, rangeRefString } from "@/lib/formulaEngine/address";
import { useT } from "@/i18n";
import { useCoarsePointer } from "./SelectionHandle";
import { forgetClosedEditor, typeKey, usePointingStore } from "./pointing";
import { closeBrackets } from "./pointText";

/** Characters of a formula the bar's line holds at 360px in 14px monospace, give or take. */
const TEXT_FITS = 38;

/** The keys a phone keyboard hides a layer or two down, in the order a formula reaches for them. */
const KEYS = [
  { chars: "(", name: "open" },
  { chars: ")", name: "close" },
  { chars: ",", name: "comma" },
  { chars: ":", name: "colon" },
  { chars: "+", name: "plus" },
  { chars: "-", name: "minus" },
] as const;

/**
 * How far the on-screen keyboard reaches up the page, so the bar can sit on top of it.
 *
 * A phone raising its keyboard shrinks the visual viewport and leaves the layout one alone (the
 * default on Android Chrome and on iOS), so a bar pinned to the bottom of the layout would be
 * under the keys. The difference between the two is the keyboard.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const measure = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    measure();
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    return () => {
      vv.removeEventListener("resize", measure);
      vv.removeEventListener("scroll", measure);
    };
  }, []);
  return inset;
}

/** A formula open in an editor on a touch screen — the grid is being pointed at, not edited. */
export function usePointingActive(): boolean {
  const coarse = useCoarsePointer();
  const open = usePointingStore((s) => s.editor !== null && s.text.startsWith("="));
  return coarse && open;
}

/**
 * The bar above the keyboard while a formula is typed on a phone (#99).
 *
 * Typing `=` used to be a trap on a phone: a tap on the cell you wanted in the formula saved the
 * half-formula and moved on. Now the tap puts the cell's address in (the grid does that, see
 * `pointing.ts`), and this bar holds what the tap cannot: the brackets and operators a phone
 * keyboard keeps a layer or two down, a way to finish, and a way out.
 *
 * Every button keeps the editor's focus — a press here must not close the keyboard it sits on.
 */
export default function PointingBar() {
  const t = useT();
  const coarse = useCoarsePointer();
  const editor = usePointingStore((s) => s.editor);
  const text = usePointingStore((s) => s.text);
  const pointed = usePointingStore((s) => s.pointed);
  const inset = useKeyboardInset();

  if (!coarse || !editor || !text.startsWith("=")) return null;

  const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();
  const done = () => {
    const final = closeBrackets(editor.input.value);
    editor.commit(final);
    requestAnimationFrame(forgetClosedEditor);
  };
  const cancel = () => {
    editor.cancel();
    requestAnimationFrame(forgetClosedEditor);
  };
  const pointedRef = pointed
    ? pointed.range.startRow === pointed.range.endRow && pointed.range.startCol === pointed.range.endCol
      ? cellRef(pointed.range.startRow, pointed.range.startCol)
      : rangeRefString(pointed.range.startRow, pointed.range.startCol, pointed.range.endRow, pointed.range.endCol)
    : null;

  return (
    <div
      className="fixed inset-x-0 z-50 border-t border-zinc-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
      style={{ bottom: inset }}
    >
      {/* The formula as it stands, in the one place that is always on screen while it is typed:
          the cell's editor is 112px wide and the formula bar shows the cell, not the draft (PO's
          check of #142 at 390px). Kept to one line, showing its end — where the typing is. */}
      <p className="overflow-hidden whitespace-nowrap bg-emerald-50 px-3 pt-1 font-mono text-sm text-zinc-900">
        {text.length > TEXT_FITS ? `…${text.slice(-(TEXT_FITS - 1))}` : text}
      </p>
      <p aria-live="polite" className="bg-emerald-50 px-3 pb-1 text-xs text-emerald-800">
        {pointedRef ? t.pointing.added(pointedRef) : t.pointing.hint}
      </p>
      <div role="toolbar" aria-label={t.pointing.label} className="flex items-center gap-1 px-2 py-1.5">
        <button
          onPointerDown={keep}
          onMouseDown={keep}
          onClick={cancel}
          aria-label={t.pointing.cancel}
          title={t.pointing.cancel}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100"
        >
          <X size={18} aria-hidden />
        </button>
        {KEYS.map((key) => (
          <button
            key={key.name}
            onPointerDown={keep}
            onMouseDown={keep}
            onClick={() => typeKey(key.chars)}
            aria-label={t.pointing.keys[key.name]}
            // No minimum width: the keys share what Done and ✕ leave. At 36px each they pushed Done
            // off a 360px screen (PO's check of #144); at 320 they are still 25px, over the 24px floor.
            className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-md bg-zinc-100 font-mono text-base text-zinc-900 hover:bg-zinc-200"
          >
            {key.chars === "-" ? "−" : key.chars}
          </button>
        ))}
        <button
          onPointerDown={keep}
          onMouseDown={keep}
          onClick={done}
          className="ml-1 flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          <Check size={16} aria-hidden /> {t.pointing.done}
        </button>
      </div>
    </div>
  );
}
