"use client";

import { useState } from "react";
import clsx from "clsx";
import { Table2 } from "lucide-react";
import { PIVOT_AGGS, PivotAgg } from "@/lib/pivot";
import { rangeRefString } from "@/lib/formulaEngine/address";
import { computeSheet } from "@/lib/sheet";
import { selectActiveSelection, selectActiveSheet, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";

/**
 * Picks the fields for a pivot and builds it onto a new sheet.
 *
 * The field list comes from the *selection's own first row*, not from the sheet's columns, because
 * a pivot is over a chosen block and naming its fields "A, B, C" would make the user translate
 * letters to headings in their head. Selecting the block and reading its headings back is also the
 * fastest way to find out you selected the wrong thing.
 *
 * Row fields are a multi-select, the column field is one or none, and both offer only the columns
 * that are actually in the selection — an unpickable field is a question the panel shouldn't ask.
 */
export default function PivotPanel() {
  const t = useT();
  const sheet = useSheetStore(selectActiveSheet);
  const selection = useSheetStore(selectActiveSelection);
  const buildPivotSheet = useSheetStore((s) => s.buildPivotSheet);

  const [rowFields, setRowFields] = useState<number[]>([0]);
  const [colField, setColField] = useState<number | null>(null);
  const [valueField, setValueField] = useState(1);
  const [agg, setAgg] = useState<PivotAgg>("sum");
  const [problem, setProblem] = useState<string | null>(null);

  // Header labels, read live so switching selection re-reads them without a button press.
  const computed = computeSheet(sheet);
  const width = selection.endCol - selection.startCol + 1;
  const fields = Array.from({ length: width }, (_, i) => {
    const text = computed.display[selection.startRow]?.[selection.startCol + i] ?? "";
    return text.trim() || `#${i + 1}`;
  });
  const enoughRows = selection.endRow > selection.startRow;

  const toggleRowField = (i: number) =>
    setRowFields((prev) => (prev.includes(i) ? prev.filter((f) => f !== i) : [...prev, i]));

  const build = () => {
    if (!enoughRows) return setProblem(t.pivot.needRows);
    if (rowFields.length === 0) return setProblem(t.pivot.pickRowField);
    setProblem(null);
    // A false result means the selection produced no groups — say so rather than switching to a
    // sheet that turned out empty.
    if (!buildPivotSheet({ rowFields, colField, valueField, agg })) setProblem(t.pivot.needRows);
  };

  const chip = (active: boolean) =>
    clsx(
      "rounded-md border px-2 py-1 text-xs transition-colors",
      active ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
    );

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <Table2 size={15} className="text-emerald-600" /> {t.pivot.title}
        </h2>
        <p className="mt-1 text-xs text-zinc-500">{t.pivot.subtitle}</p>
      </div>

      <p className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-600">
        {t.pivot.sourceLabel}{" "}
        <span className="font-mono text-zinc-800">
          {rangeRefString(selection.startRow, selection.startCol, selection.endRow, selection.endCol)}
        </span>
      </p>

      <fieldset>
        <legend className="text-xs font-medium text-zinc-700">{t.pivot.rowFields}</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {fields.map((name, i) => (
            <button key={i} type="button" onClick={() => toggleRowField(i)} className={chip(rowFields.includes(i))}>
              {name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-medium text-zinc-700">{t.pivot.colField}</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setColField(null)} className={chip(colField === null)}>
            {t.pivot.none}
          </button>
          {fields.map((name, i) => (
            <button key={i} type="button" onClick={() => setColField(i)} className={chip(colField === i)}>
              {name}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
        {t.pivot.valueField}
        <select
          value={valueField}
          onChange={(e) => setValueField(Number(e.target.value))}
          className="min-h-11 rounded-md border border-zinc-300 px-2 text-sm font-normal text-zinc-800 outline-none focus:border-emerald-500 sm:min-h-0 sm:py-1.5"
        >
          {fields.map((name, i) => (
            <option key={i} value={i}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
        {t.pivot.aggLabel}
        <select
          value={agg}
          onChange={(e) => setAgg(e.target.value as PivotAgg)}
          className="min-h-11 rounded-md border border-zinc-300 px-2 text-sm font-normal text-zinc-800 outline-none focus:border-emerald-500 sm:min-h-0 sm:py-1.5"
        >
          {PIVOT_AGGS.map((a) => (
            <option key={a} value={a}>
              {t.pivot.aggNames[a]}
            </option>
          ))}
        </select>
      </label>

      {problem && <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">{problem}</p>}

      <button
        onClick={build}
        className="min-h-11 rounded-md bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800 sm:min-h-0 sm:py-2"
      >
        {t.pivot.build}
      </button>
    </div>
  );
}
