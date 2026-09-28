// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useRef } from "react";
import { Ban } from "lucide-react";
import { useT } from "@/i18n";

/**
 * Background colours as a handful of swatches, not a colour wheel.
 *
 * The first thing an Excel user reaches for on a header row is the paint bucket, and the app had
 * none — imported fills showed, but nothing could set one (blind test U24). Swatches rather than
 * `<input type="color">` because a header wants a light tint that keeps the text readable, and a
 * wheel on a phone is a small, fiddly target that invites a dark fill under dark text. The tints are
 * the ones Excel's own palette puts in its lightest row, so a file sent back looks at home there.
 */
export const FILL_SWATCHES = [
  { key: "yellow", hex: "#fff2cc" },
  { key: "green", hex: "#e2efda" },
  { key: "blue", hex: "#ddebf7" },
  { key: "orange", hex: "#fce4d6" },
  { key: "red", hex: "#f8cbad" },
  { key: "purple", hex: "#e4dfec" },
  { key: "grey", hex: "#ededed" },
] as const;

export default function FillColorPopover({
  anchor,
  current,
  onPick,
  onClose,
}: {
  anchor: { x: number; y: number };
  current: string | undefined;
  onPick: (hex: string | undefined) => void;
  onClose: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const pick = (hex: string | undefined) => {
    onPick(hex);
    onClose();
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t.formatBar.fillTitle}
      className="fixed z-50 w-56 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl"
      style={{ left: anchor.x, top: anchor.y }}
    >
      <p className="mb-2 text-xs font-semibold text-zinc-700">{t.formatBar.fillTitle}</p>
      <div className="grid grid-cols-4 gap-2">
        {FILL_SWATCHES.map((s) => (
          <button
            key={s.key}
            onClick={() => pick(s.hex)}
            aria-label={t.formatBar.fillColors[s.key]}
            aria-pressed={current?.toLowerCase() === s.hex}
            title={t.formatBar.fillColors[s.key]}
            className="h-11 rounded-md border border-zinc-300 aria-pressed:ring-2 aria-pressed:ring-emerald-600"
            style={{ background: s.hex }}
          />
        ))}
        <button
          onClick={() => pick(undefined)}
          aria-label={t.formatBar.fillNone}
          title={t.formatBar.fillNone}
          className="flex h-11 items-center justify-center rounded-md border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
        >
          <Ban size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
