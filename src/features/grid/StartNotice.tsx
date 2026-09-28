// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { FlaskConical } from "lucide-react";
import { useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";

/**
 * The way to the sample, on a workbook with nothing in it yet.
 *
 * The app opens blank. It used to open on a sample workbook so a first press of Pivot had something
 * to show, but a grid already full of somebody's coffee prices read as data left behind — the owner
 * asked for it gone, and for the sample to be there for whoever wants to try first. So this sits
 * where the sample's own notice sat, and goes the moment there is anything in the grid, which is
 * also the moment opening the sample would start costing somebody their work.
 */
export default function StartNotice() {
  const t = useT();
  const openSample = useSheetStore((s) => s.openSample);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-900">
      <FlaskConical size={14} className="shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 leading-relaxed">{t.startNotice.text}</p>
      <button
        onClick={openSample}
        className="shrink-0 rounded border border-emerald-300 bg-white px-2.5 py-1 font-medium text-emerald-800 transition-colors hover:border-emerald-500 hover:bg-emerald-100"
      >
        {t.startNotice.openSample}
      </button>
    </div>
  );
}
