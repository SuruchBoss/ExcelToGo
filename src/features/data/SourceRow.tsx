"use client";

import { useEffect, useState } from "react";
import { MoreVertical, Plus } from "lucide-react";
import clsx from "clsx";
import { PublicDataSource } from "@/lib/dataSources/types";
import { useDataSourceStore } from "@/store/dataSourceStore";
import { useT } from "@/i18n";
import { setLiveDragData } from "./dragTypes";

interface Props {
  source: PublicDataSource;
  onUse: () => void;
  onEdit: () => void;
}

function useSecondsSince(iso: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000)) : 0;
}

/** One source in the side panel: name, freshness, and a single primary action. Everything heavier
 *  (preview, what to insert, where) lives in the picker dialog so this column stays scannable. */
export default function SourceRow({ source, onUse, onEdit }: Props) {
  const t = useT();
  const table = useDataSourceStore((s) => s.data[source.id]);
  const error = useDataSourceStore((s) => s.errors[source.id]);
  const refresh = useDataSourceStore((s) => s.refresh);
  const deleteSource = useDataSourceStore((s) => s.deleteSource);
  const ago = useSecondsSince(table?.fetchedAt);
  const [menuOpen, setMenuOpen] = useState(false);

  const size = table
    ? table.rows.length > 1
      ? t.data.itemCount(table.rows.length, table.columns.length)
      : t.data.valueCount(table.columns.length)
    : t.data.loading;

  return (
    <div className="relative rounded-lg border border-zinc-200 bg-white p-2.5 hover:border-emerald-200">
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-800">{source.name}</span>
        {table && (
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            {t.data.live}
          </span>
        )}
        {error && <span className="shrink-0 text-[11px] font-semibold text-red-600">{t.data.error}</span>}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          title={t.data.options}
          className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <MoreVertical size={14} />
        </button>
      </div>

      <p className="mt-0.5 text-[11px] text-zinc-400">
        {size}
        {table && ` · ${t.data.updatedAgo(ago)}`}
      </p>
      {error && <p className="mt-1 rounded bg-red-50 p-1.5 text-[11px] text-red-600">{error}</p>}

      <button
        onClick={onUse}
        draggable={!!table}
        onDragStart={(e) => setLiveDragData(e, { sourceId: source.id, kind: "table" })}
        disabled={!table}
        className={clsx(
          "mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white",
          table ? "hover:bg-emerald-700" : "cursor-not-allowed opacity-40"
        )}
      >
        <Plus size={15} /> {t.data.use}
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-2 top-9 z-20 w-44 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg">
            <button
              onClick={() => {
                setMenuOpen(false);
                void refresh(source.id);
              }}
              className="block w-full rounded px-2.5 py-1.5 text-left text-[13px] text-zinc-700 hover:bg-zinc-50"
            >
              {t.data.refresh}
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
              className="block w-full rounded px-2.5 py-1.5 text-left text-[13px] text-zinc-700 hover:bg-zinc-50"
            >
              {t.data.edit}
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                if (confirm(t.data.confirmRemove(source.name))) void deleteSource(source.id);
              }}
              className="block w-full rounded px-2.5 py-1.5 text-left text-[13px] text-red-600 hover:bg-red-50"
            >
              {t.data.remove}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
