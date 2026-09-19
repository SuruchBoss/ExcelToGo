"use client";

import { useState } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { parseList, ruleAt, type ValidationRule } from "@/lib/dataValidation";
import { selectActiveSelection, selectActiveSheet, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import { useClickAway } from "./useClickAway";
import clsx from "clsx";

/**
 * Sets the rule on what the selected cells will accept.
 *
 * Unlike the comment box this works on a rectangle, because that is the shape the feature is
 * actually used in: nobody puts a dropdown on one cell, they put it on a column. The three kinds
 * are the three that earn their place — a list, a number range, a length cap. "Date between" and
 * "custom formula" are the next two and are written down as gaps rather than half-built.
 */
export default function ValidationPopover({
  anchor,
  onClose,
}: {
  anchor: { x: number; y: number };
  onClose: () => void;
}) {
  const t = useT();
  const sheet = useSheetStore(selectActiveSheet);
  const selection = useSheetStore(selectActiveSelection);
  const setValidation = useSheetStore((s) => s.setValidation);
  const existing = ruleAt(sheet, selection.anchorRow, selection.anchorCol);
  useClickAway(true, onClose);

  const [kind, setKind] = useState<ValidationRule["kind"]>(existing?.kind ?? "list");
  const [list, setList] = useState(existing?.kind === "list" ? existing.values.join(", ") : "");
  const [min, setMin] = useState(existing?.kind === "number" && existing.min !== undefined ? String(existing.min) : "");
  const [max, setMax] = useState(existing?.kind === "number" && existing.max !== undefined ? String(existing.max) : "");
  const [len, setLen] = useState(existing?.kind === "length" ? String(existing.max) : "");

  // What "Apply" would write, or nothing when the boxes do not yet describe a rule. An empty list
  // or a range with neither end is not a strict rule, it is a rule that refuses everything or
  // nothing; either way applying it is a trap, so the button is simply off until it means something.
  const built = ((): ValidationRule | undefined => {
    if (kind === "list") {
      const values = parseList(list);
      return values.length > 0 ? { kind: "list", values } : undefined;
    }
    if (kind === "number") {
      const lo = min.trim() === "" ? undefined : Number(min);
      const hi = max.trim() === "" ? undefined : Number(max);
      if (lo !== undefined && Number.isNaN(lo)) return undefined;
      if (hi !== undefined && Number.isNaN(hi)) return undefined;
      if (lo === undefined && hi === undefined) return undefined;
      return { kind: "number", min: lo, max: hi };
    }
    const cap = Number(len);
    return len.trim() !== "" && Number.isFinite(cap) && cap > 0 ? { kind: "length", max: cap } : undefined;
  })();

  const kinds: { id: ValidationRule["kind"]; label: string }[] = [
    { id: "list", label: t.validation.kindList },
    { id: "number", label: t.validation.kindNumber },
    { id: "length", label: t.validation.kindLength },
  ];

  const field = "w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500";

  return (
    <div
      // Same contract as the comment box: useClickAway listens on the window, so this has to stop
      // its own clicks from reaching it.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="dialog"
      aria-label={t.validation.title}
      className="fixed z-50 w-80 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl"
      style={{ left: anchor.x, top: anchor.y }}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-emerald-600" />
        <span className="text-xs font-semibold text-zinc-800">{t.validation.title}</span>
      </div>
      <p className="mb-2.5 text-[11px] leading-relaxed text-zinc-500">{t.validation.subtitle}</p>

      <div className="mb-2.5 flex gap-1" role="group" aria-label={t.validation.title}>
        {kinds.map((option) => (
          <button
            key={option.id}
            onClick={() => setKind(option.id)}
            aria-pressed={kind === option.id}
            className={clsx(
              "min-h-9 flex-1 rounded-md border px-1.5 text-[11px] font-medium sm:min-h-0 sm:py-1.5",
              kind === option.id
                ? "border-emerald-600 bg-emerald-700 text-white"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {kind === "list" && (
        <label className="block text-[11px] font-medium text-zinc-600">
          {t.validation.listLabel}
          <textarea
            value={list}
            onChange={(e) => setList(e.target.value)}
            rows={3}
            placeholder={t.validation.listPlaceholder}
            className={clsx(field, "mt-1 resize-none font-normal")}
          />
        </label>
      )}

      {kind === "number" && (
        <div className="flex gap-2">
          <label className="block flex-1 text-[11px] font-medium text-zinc-600">
            {t.validation.minLabel}
            <input
              value={min}
              onChange={(e) => setMin(e.target.value)}
              inputMode="decimal"
              className={clsx(field, "mt-1 font-normal")}
            />
          </label>
          <label className="block flex-1 text-[11px] font-medium text-zinc-600">
            {t.validation.maxLabel}
            <input
              value={max}
              onChange={(e) => setMax(e.target.value)}
              inputMode="decimal"
              className={clsx(field, "mt-1 font-normal")}
            />
          </label>
        </div>
      )}

      {kind === "length" && (
        <label className="block text-[11px] font-medium text-zinc-600">
          {t.validation.lengthLabel}
          <input
            value={len}
            onChange={(e) => setLen(e.target.value)}
            inputMode="numeric"
            className={clsx(field, "mt-1 font-normal")}
          />
        </label>
      )}

      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          onClick={() => {
            if (!built) return;
            setValidation(built);
            onClose();
          }}
          disabled={!built}
          className={clsx(
            "min-h-9 flex-1 rounded-md px-3 text-xs font-semibold sm:min-h-0 sm:py-1.5",
            built ? "bg-emerald-700 text-white hover:bg-emerald-800" : "cursor-not-allowed bg-zinc-100 text-zinc-400"
          )}
        >
          {t.validation.apply}
        </button>
        <button
          onClick={() => {
            setValidation(undefined);
            onClose();
          }}
          title={t.validation.clear}
          aria-label={t.validation.clear}
          className="flex min-h-9 items-center justify-center rounded-md border border-zinc-300 px-2 text-zinc-500 hover:bg-red-50 hover:text-red-700 sm:min-h-0 sm:py-1.5"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
