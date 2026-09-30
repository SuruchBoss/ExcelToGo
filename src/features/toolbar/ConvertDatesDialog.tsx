// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarCheck, X } from "lucide-react";
import { type DateCalendar, type DateOrder, planConversion } from "@/lib/dateConvert";
import { BE_DATE_CODE, formatSerial } from "@/lib/excelDate";
import { selectActiveSelection, selectActiveSheet, useHiddenRows, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";

/** How many rows the preview shows: enough to see the pattern, few enough to read at a glance. */
const PREVIEW_ROWS = 5;

/**
 * "Convert to dates" (#82): the dates that cannot be read without being told how.
 *
 * `15/01/69` is 2569 B.E. or 1969, and `03/04/26` is March or April, so nothing reads them on its
 * own. Here the person says the order and the calendar and sees, before anything changes, what the
 * first few cells will become and how many cannot be read — from the same plan the store then
 * applies, so the preview is not a promise, it is the change. B.E. and day first are the defaults
 * because that is how the people this is for write dates.
 */
export default function ConvertDatesDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const sheet = useSheetStore(selectActiveSheet);
  const selection = useSheetStore(selectActiveSelection);
  const convert = useSheetStore((s) => s.convertSelectionToDates);
  // The preview counts what the command will touch, so it skips the rows a filter hides too (#50).
  const hiddenRows = useHiddenRows();
  const [order, setOrder] = useState<DateOrder>("dmy");
  const [calendar, setCalendar] = useState<DateCalendar>("be");

  const plan = useMemo(
    () => planConversion((r, c) => sheet.cells[r]?.[c] ?? "", selection, order, calendar, hiddenRows),
    [sheet, selection, order, calendar, hiddenRows]
  );

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    firstRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      // Radio groups are one stop each, as the browser tabs through them.
      const stops = [...panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:checked")];
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const shown = (serial: number, kind: "date" | "datetime" | "time", iso: string) =>
    calendar === "be" && kind !== "time" ? `${formatSerial(serial, BE_DATE_CODE[kind])} (${iso})` : iso;

  const radio = "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm text-zinc-800 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 sm:min-h-9";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div onClick={onClose} aria-hidden className="absolute inset-0 bg-zinc-900/40" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-lg sm:rounded-xl sm:pb-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-zinc-900">
            {t.convertDates.title}
          </h2>
          <button
            onClick={onClose}
            aria-label={t.convertDates.cancel}
            className="-mr-1 -mt-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-zinc-700">{t.convertDates.body}</p>

        <fieldset className="mt-4">
          <legend className="text-xs font-semibold text-zinc-600">{t.convertDates.order}</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(["dmy", "mdy", "ymd"] as const).map((value, i) => (
              <label key={value} className={radio}>
                <input
                  ref={i === 0 ? firstRef : undefined}
                  type="radio"
                  name="convert-order"
                  value={value}
                  checked={order === value}
                  onChange={() => setOrder(value)}
                  className="accent-emerald-700"
                />
                {t.convertDates.orders[value]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-3">
          <legend className="text-xs font-semibold text-zinc-600">{t.convertDates.calendar}</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(["be", "ce"] as const).map((value) => (
              <label key={value} className={radio}>
                <input
                  type="radio"
                  name="convert-calendar"
                  value={value}
                  checked={calendar === value}
                  onChange={() => setCalendar(value)}
                  className="accent-emerald-700"
                />
                {t.convertDates.calendars[value]}
              </label>
            ))}
          </div>
        </fieldset>

        <section aria-live="polite" className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <h3 className="text-xs font-semibold text-zinc-600">{t.convertDates.preview}</h3>
          {plan.changes.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-700">{t.convertDates.nothing}</p>
          ) : (
            <table className="mt-1.5 w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-500">
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {t.convertDates.before}
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    {t.convertDates.after}
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.changes.slice(0, PREVIEW_ROWS).map((change) => (
                  <tr key={`${change.row},${change.col}`} className="border-t border-zinc-200">
                    <td className="py-1 pr-3 font-mono text-zinc-700">{change.before}</td>
                    <td className="py-1 font-mono text-zinc-900">{shown(change.after.serial, change.after.kind, change.after.iso)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-zinc-600">{t.convertDates.counts(plan.changes.length, plan.unreadable.length)}</p>
        </section>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="min-h-11 rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 sm:min-h-9">
            {t.convertDates.cancel}
          </button>
          <button
            onClick={() => {
              convert(order, calendar);
              onClose();
            }}
            disabled={plan.changes.length === 0}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9"
          >
            <CalendarCheck size={16} aria-hidden />
            {t.convertDates.confirm(plan.changes.length)}
          </button>
        </div>
      </div>
    </div>
  );
}
