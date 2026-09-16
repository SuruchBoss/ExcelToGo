"use client";

import { FlaskConical } from "lucide-react";
import { useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";

/**
 * Says, once and where it will be read, that the grid is showing sample data.
 *
 * The app opens on a seeded workbook on purpose: a first-time visitor who presses Pivot or Chart on
 * an empty sheet learns nothing, and every total in the sample is a formula, so changing one price
 * demonstrates the engine in a single edit. But nothing said so, and the only banner on screen was
 * the autosave one — "your data is kept in this browser" — which reads as a claim that the sample
 * belongs to you. The first person to look at it fresh asked why the app had data left over.
 *
 * It needs no dismiss button: it disappears the moment anything is touched, which is the same
 * moment the sentence stops being true.
 */
export default function SampleNotice() {
  const t = useT();
  const startBlank = useSheetStore((s) => s.startBlank);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-900">
      <FlaskConical size={14} className="shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 leading-relaxed">
        {t.sampleNotice.text} <span className="hidden sm:inline">{t.sampleNotice.tip}</span>
      </p>
      <button
        onClick={startBlank}
        className="shrink-0 rounded border border-emerald-300 bg-white px-2.5 py-1 font-medium text-emerald-800 transition-colors hover:border-emerald-500 hover:bg-emerald-100"
      >
        {t.sampleNotice.startBlank}
      </button>
    </div>
  );
}
