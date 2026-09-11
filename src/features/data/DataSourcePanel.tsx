"use client";

import { useState } from "react";
import { Database, Plus, X } from "lucide-react";
import { PublicDataSource } from "@/lib/dataSources/types";
import { useDataSourceStore } from "@/store/dataSourceStore";
import { useLiveBlocks, useSheetStore } from "@/store/sheetStore";
import { cellRef } from "@/lib/formulaEngine/address";
import { useT } from "@/i18n";
import SourceRow from "./SourceRow";
import SourceSetupDialog from "./SourceSetupDialog";
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

  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-hidden">
      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <Database size={16} className="text-emerald-600" /> {t.data.title}
        </h2>
        <p className="text-xs text-zinc-500">{t.data.subtitle}</p>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto pr-1">
        {sources.length === 0 && <p className="p-4 text-center text-xs text-zinc-400">{t.data.empty}</p>}
        {sources.map((src) => (
          <SourceRow
            key={src.id}
            source={src}
            onUse={() => openPicker({ sourceId: src.id })}
            onEdit={() => setSetup({ open: true, source: src })}
          />
        ))}
      </div>

      <button
        onClick={() => setSetup({ open: true })}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-300 px-3 py-2 text-[13px] font-medium text-zinc-500 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
      >
        <Plus size={15} /> {t.data.addSource}
      </button>

      <div className="mt-auto border-t border-zinc-100 pt-2.5">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">{t.data.inSheet}</p>
        {blocks.length === 0 ? (
          <p className="text-xs text-zinc-400">{t.data.inSheetEmpty}</p>
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
                  className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
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
