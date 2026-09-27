// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, Database, Plus, X } from "lucide-react";
import Link from "next/link";
import { PublicDataSource } from "@/lib/dataSources/types";
import { useDataSourceStore } from "@/store/dataSourceStore";
import { useLiveBlocks, useSheetStore } from "@/store/sheetStore";
import { cellRef } from "@/lib/formulaEngine/address";
import { useT } from "@/i18n";
import { DEMO_MODE } from "@/lib/demoMode";
import SourceRow from "./SourceRow";
import SourceSetupDialog from "./SourceSetupDialog";
import SourcesUnlock, { useSourcesToken } from "./SourcesUnlock";
import { valueLabel } from "./valueLabel";

/** The side panel stays a short list: what's connected, and one button per source. Choosing what
 *  to insert and where happens in the picker dialog, which has room to show the actual data. */
export default function DataSourcePanel() {
  const t = useT();
  const sources = useDataSourceStore((s) => s.sources);
  const data = useDataSourceStore((s) => s.data);
  const blocks = useLiveBlocks();
  const removeLiveBlock = useSheetStore((s) => s.removeLiveBlock);
  const openPicker = useSheetStore((s) => s.openDataPicker);
  const [setup, setSetup] = useState<{ open: boolean; source?: PublicDataSource }>({ open: false });
  const token = useSourcesToken();
  // A public demo reads the three built-ins with no token and cannot change any of them, so the
  // unlock box and every write control are not "disabled" here — they are absent, because there is
  // nothing behind them to unlock or to save.
  const unlocked = DEMO_MODE || Boolean(token);

  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-hidden">
      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <Database size={16} className="text-emerald-600" /> {t.data.title}
        </h2>
        <p className="text-xs text-zinc-500">{t.data.subtitle}</p>
      </div>

      {!DEMO_MODE && <SourcesUnlock />}

      {/* On the demo this used to be one grey sentence saying "clone it and run it yourself", and
          the person who wrote the app read past it looking for a button. So it is a box with a
          question in bold — the one the reader arrived with — and a way to the answer. */}
      {DEMO_MODE && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
          <p className="text-[13px] font-semibold text-emerald-950">{t.data.ownTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-700">{t.data.demoNote}</p>
          <Link
            href="/guide"
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 sm:min-h-0 sm:py-1.5"
          >
            <BookOpen size={14} aria-hidden /> {t.data.guideCta} <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      )}

      {!DEMO_MODE && !unlocked && (
        <Link href="/guide" className="-mt-1 inline-flex items-center gap-1 self-start text-xs font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-950">
          {t.data.guideLinkLocked} <ArrowRight size={12} aria-hidden />
        </Link>
      )}

      {unlocked && (
      <div className="flex flex-col gap-2 overflow-y-auto pr-1">
        {sources.length === 0 && <p className="p-4 text-center text-xs text-zinc-500">{t.data.empty}</p>}
        {sources.map((src) => (
          <SourceRow
            key={src.id}
            source={src}
            onUse={() => openPicker({ sourceId: src.id })}
            onEdit={DEMO_MODE ? undefined : () => setSetup({ open: true, source: src })}
          />
        ))}
      </div>
      )}

      {unlocked && !DEMO_MODE && (
        <button
          onClick={() => setSetup({ open: true })}
          className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-300 px-3 py-2 text-[13px] font-medium text-zinc-500 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
        >
          <Plus size={15} /> {t.data.addSource}
        </button>
      )}
      {unlocked && !DEMO_MODE && (
        <Link href="/guide" className="-mt-1 inline-flex items-center gap-1 self-center text-[11px] text-zinc-600 underline underline-offset-2 hover:text-emerald-800">
          {t.data.guideLink}
        </Link>
      )}

      <div className="mt-auto border-t border-zinc-100 pt-2.5">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t.data.inSheet}</p>
        {blocks.length === 0 ? (
          <p className="text-xs text-zinc-500">{t.data.inSheetEmpty}</p>
        ) : (
          <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-2 py-0.5 text-xs text-zinc-700">
                <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700">
                  {cellRef(b.anchorRow, b.anchorCol)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {sourceName(b.sourceId)} ·{" "}
                  {b.kind === "table"
                    ? t.data.picker.wholeTable
                    : valueLabel(t, data[b.sourceId], b.column ?? "", b.aggregate ?? "first")}
                </span>
                <button
                  onClick={() => removeLiveBlock(b.id)}
                  title={t.data.unlink}
                  className="rounded p-0.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {setup.open && <SourceSetupDialog source={setup.source} onClose={() => setSetup({ open: false })} />}
    </div>
  );
}
