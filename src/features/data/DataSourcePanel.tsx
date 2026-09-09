"use client";

import { useState } from "react";
import { Database, Plus, Unlink } from "lucide-react";
import { PublicDataSource } from "@/lib/dataSources/types";
import { useDataSourceStore } from "@/store/dataSourceStore";
import { useLiveBlocks, useSheetStore } from "@/store/sheetStore";
import { cellRef } from "@/lib/formulaEngine/address";
import { useT } from "@/i18n";
import SourceCard from "./SourceCard";
import SourceSetupDialog from "./SourceSetupDialog";

export default function DataSourcePanel() {
  const t = useT();
  const sources = useDataSourceStore((s) => s.sources);
  const data = useDataSourceStore((s) => s.data);
  const blocks = useLiveBlocks();
  const removeLiveBlock = useSheetStore((s) => s.removeLiveBlock);
  const [dialog, setDialog] = useState<{ open: boolean; source?: PublicDataSource }>({ open: false });

  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? id;
  const columnLabel = (sourceId: string, key: string | undefined) =>
    data[sourceId]?.columns.find((c) => c.key === key)?.label ?? key ?? "";

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <Database size={16} className="text-emerald-600" /> {t.data.title}
        </h2>
        <p className="text-xs text-zinc-500">{t.data.subtitle}</p>
      </div>

      <button
        onClick={() => setDialog({ open: true })}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-emerald-400 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
      >
        <Plus size={15} /> {t.data.addSource}
      </button>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {sources.length === 0 && <p className="p-4 text-center text-xs text-zinc-400">{t.data.empty}</p>}
        {sources.map((src) => (
          <SourceCard key={src.id} source={src} onEdit={() => setDialog({ open: true, source: src })} />
        ))}

        {blocks.length > 0 && (
          <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">{t.data.placedHere}</p>
            <ul className="flex flex-col gap-1">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center gap-2 rounded bg-white px-2 py-1 text-xs text-zinc-700">
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700">{cellRef(b.anchorRow, b.anchorCol)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {sourceName(b.sourceId)} ·{" "}
                    {b.kind === "table"
                      ? t.data.placedTable
                      : t.data.placedValue(
                          `${b.aggregate && b.aggregate !== "first" ? `${t.data.aggregate[b.aggregate]} ` : ""}${columnLabel(b.sourceId, b.column)}`
                        )}
                  </span>
                  <button onClick={() => removeLiveBlock(b.id)} title={t.data.unlink} className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600">
                    <Unlink size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {dialog.open && <SourceSetupDialog source={dialog.source} onClose={() => setDialog({ open: false })} />}
    </div>
  );
}
