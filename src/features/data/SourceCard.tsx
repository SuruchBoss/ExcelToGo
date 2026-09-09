"use client";

import { useEffect, useState } from "react";
import { Database, GripVertical, Pencil, RefreshCw, Trash2, Table2, Hash } from "lucide-react";
import clsx from "clsx";
import { PublicDataSource, TableData } from "@/lib/dataSources/types";
import { LiveAggregate } from "@/lib/liveBlocks";
import { useDataSourceStore } from "@/store/dataSourceStore";
import { useT } from "@/i18n";
import { setLiveDragData } from "./dragTypes";

interface Props {
  source: PublicDataSource;
  onEdit: () => void;
}

function useSecondsSince(iso: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000)) : 0;
}

interface ValueChip {
  label: string;
  column: string;
  aggregate: LiveAggregate;
}

/** Which single-value chips make sense for this table: a one-row payload (a KPI object) exposes
 *  each field directly; a multi-row table exposes totals/averages of its numeric columns plus a
 *  row count — the things a non-technical user actually wants in one cell. */
function valueChips(table: TableData, t: ReturnType<typeof useT>): ValueChip[] {
  if (table.rows.length <= 1) {
    return table.columns.map((c) => ({ label: c.label, column: c.key, aggregate: "first" }));
  }
  const chips: ValueChip[] = [];
  for (const c of table.columns) {
    if (!c.numeric) continue;
    chips.push({ label: `${t.data.aggregate.sum} ${c.label}`, column: c.key, aggregate: "sum" });
    chips.push({ label: `${t.data.aggregate.avg} ${c.label}`, column: c.key, aggregate: "avg" });
  }
  if (table.columns[0]) chips.push({ label: t.data.aggregate.count, column: table.columns[0].key, aggregate: "count" });
  return chips;
}

function formatCell(v: string | number | boolean | null): string {
  if (v === null) return "";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}

export default function SourceCard({ source, onEdit }: Props) {
  const t = useT();
  const table = useDataSourceStore((s) => s.data[source.id]);
  const error = useDataSourceStore((s) => s.errors[source.id]);
  const loading = useDataSourceStore((s) => s.loading[source.id]);
  const refresh = useDataSourceStore((s) => s.refresh);
  const deleteSource = useDataSourceStore((s) => s.deleteSource);
  const ago = useSecondsSince(table?.fetchedAt);
  const [open, setOpen] = useState(true);

  const status = error ? "error" : table ? "live" : "loading";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <Database size={15} className="shrink-0 text-emerald-600" />
          <span className="truncate text-sm font-semibold text-zinc-800">{source.name}</span>
          <span
            className={clsx(
              "ml-auto flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              status === "live" && "bg-emerald-50 text-emerald-700",
              status === "error" && "bg-red-50 text-red-600",
              status === "loading" && "bg-zinc-100 text-zinc-500"
            )}
          >
            <span
              className={clsx(
                "h-1.5 w-1.5 rounded-full",
                status === "live" && "bg-emerald-500 animate-pulse",
                status === "error" && "bg-red-500",
                status === "loading" && "bg-zinc-400"
              )}
            />
            {status === "live" ? t.data.live : status === "error" ? t.data.error : t.data.loading}
          </span>
        </button>
        <button onClick={() => void refresh(source.id)} title={t.data.refresh} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
          <RefreshCw size={13} className={clsx(loading && "animate-spin")} />
        </button>
        <button onClick={onEdit} title={t.data.edit} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
          <Pencil size={13} />
        </button>
        <button
          onClick={() => {
            if (confirm(t.data.confirmRemove(source.name))) void deleteSource(source.id);
          }}
          title={t.data.remove}
          className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {open && (
        <div className="border-t border-zinc-100 px-3 py-2">
          {error && <p className="mb-2 rounded bg-red-50 p-2 text-xs text-red-600">{error}</p>}
          {table && (
            <>
              <p className="mb-2 text-[11px] text-zinc-400">
                {t.data.rowCount(table.rows.length, table.columns.length)} · {t.data.updatedAgo(ago)} · {source.refreshSec}s
              </p>

              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{t.data.wholeTable}</p>
              <div
                draggable
                onDragStart={(e) => setLiveDragData(e, { sourceId: source.id, kind: "table" })}
                className="mt-1 flex cursor-grab items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-sm text-emerald-800 hover:border-emerald-400 active:cursor-grabbing"
                title={t.data.wholeTableHint}
              >
                <GripVertical size={14} className="text-emerald-400" />
                <Table2 size={14} />
                <span className="font-medium">{source.name}</span>
                <span className="ml-auto text-[11px] text-emerald-600">{t.data.rowCount(table.rows.length, table.columns.length)}</span>
              </div>

              {valueChips(table, t).length > 0 && (
                <>
                  <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-zinc-400">{t.data.singleValues}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5" title={t.data.singleValuesHint}>
                    {valueChips(table, t).map((chip) => (
                      <div
                        key={`${chip.aggregate}:${chip.column}`}
                        draggable
                        onDragStart={(e) =>
                          setLiveDragData(e, { sourceId: source.id, kind: "value", column: chip.column, aggregate: chip.aggregate })
                        }
                        className="flex cursor-grab items-center gap-1 rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-[11px] text-zinc-700 hover:border-emerald-400 hover:bg-emerald-50 active:cursor-grabbing"
                      >
                        <Hash size={10} className="text-zinc-400" />
                        {chip.label}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-zinc-400">{t.data.preview}</p>
              <div className="mt-1 max-h-40 overflow-auto rounded border border-zinc-200">
                <table className="w-full border-collapse text-[11px]">
                  <thead className="sticky top-0 bg-zinc-50">
                    <tr>
                      {table.columns.map((c) => (
                        <th key={c.key} className="whitespace-nowrap border-b border-zinc-200 px-2 py-1 text-left font-semibold text-zinc-600">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.slice(0, 8).map((row, i) => (
                      <tr key={i} className="odd:bg-white even:bg-zinc-50/50">
                        {row.map((v, j) => (
                          <td
                            key={j}
                            className={clsx("whitespace-nowrap border-b border-zinc-100 px-2 py-1 text-zinc-700", table.columns[j]?.numeric && "text-right tabular-nums")}
                          >
                            {formatCell(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
