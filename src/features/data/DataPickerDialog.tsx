"use client";

import { useState } from "react";
import { Hash, Table2, X } from "lucide-react";
import clsx from "clsx";
import { PublicDataSource } from "@/lib/dataSources/types";
import { aggregateColumn, blockExtent, LiveAggregate, LiveBlock, regionHasContent, valueOptionsFor } from "@/lib/liveBlocks";
import { cellRef, parseCellRef } from "@/lib/formulaEngine/address";
import { useDataSourceStore } from "@/store/dataSourceStore";
import { selectActiveSelection, selectActiveSheet, useLiveBlocks, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import { formatValue, valueLabel } from "./valueLabel";

interface Props {
  source: PublicDataSource;
  /** Set when changing what an already-placed block shows, instead of adding a new one. */
  replacing?: LiveBlock;
  onClose: () => void;
}

/**
 * The one place a user makes a choice: see the real data at a readable size, pick the whole table
 * or one summary number (shown as its actual current value, not an aggregate name), confirm where
 * it lands. Deliberately a wide modal — the side panel is too narrow to judge data in.
 */
export default function DataPickerDialog({ source, replacing, onClose }: Props) {
  const t = useT();
  const table = useDataSourceStore((s) => s.data[source.id]);
  const sheet = useSheetStore(selectActiveSheet);
  const selection = useSheetStore(selectActiveSelection);
  const blocks = useLiveBlocks();
  const addLiveBlock = useSheetStore((s) => s.addLiveBlock);
  const replaceLiveBlock = useSheetStore((s) => s.replaceLiveBlock);

  const singleRow = !table || table.rows.length <= 1;
  const [kind, setKind] = useState<"table" | "value">(replacing?.kind ?? (singleRow ? "value" : "table"));
  const [picked, setPicked] = useState<{ column: string; aggregate: LiveAggregate }>(() => {
    if (replacing?.column) return { column: replacing.column, aggregate: replacing.aggregate ?? "first" };
    const first = table ? valueOptionsFor(table)[0] : undefined;
    return first ?? { column: "", aggregate: "first" };
  });
  const [target, setTarget] = useState(() =>
    replacing ? cellRef(replacing.anchorRow, replacing.anchorCol) : cellRef(selection.anchorRow, selection.anchorCol)
  );

  if (!table) return null;

  const anchor = parseCellRef(target);
  const extent = blockExtent(kind, table);
  const overwrites =
    anchor && regionHasContent(sheet, anchor.row, anchor.col, extent.rows, extent.cols, blocks, replacing);

  const insert = () => {
    if (!anchor) return;
    const input = {
      sourceId: source.id,
      anchorRow: anchor.row,
      anchorCol: anchor.col,
      kind,
      column: kind === "value" ? picked.column : undefined,
      aggregate: kind === "value" ? picked.aggregate : undefined,
    };
    if (replacing) replaceLiveBlock(replacing.id, input, table);
    else addLiveBlock(input, table);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/35 p-5" onMouseDown={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-[17px] font-semibold text-zinc-800">
              {source.name}
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                {t.data.live}
              </span>
            </h2>
            <p className="mt-0.5 text-[13px] text-zinc-500">{t.data.picker.subtitle}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {/* A partial table has to be said out loud here above all: a "sum" card computed over
              the first N rows of a longer source reads as a total and isn't one. */}
          {table.truncated && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="font-semibold">⚠ {t.data.partial(table.rows.length)}</p>
              <p className="mt-0.5 text-amber-700">{t.data.partialHint}</p>
            </div>
          )}

          <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
            {(
              [
                { v: "table" as const, Icon: Table2, label: t.data.picker.wholeTable, hint: t.data.picker.wholeTableHint(table.rows.length, table.columns.length) },
                { v: "value" as const, Icon: Hash, label: t.data.picker.summaryValue, hint: t.data.picker.summaryValueHint },
              ]
            ).map(({ v, Icon, label, hint }) => (
              <button
                key={v}
                onClick={() => setKind(v)}
                className={clsx(
                  "flex items-start gap-2.5 rounded-xl border p-3 text-left",
                  kind === v ? "border-emerald-600 bg-emerald-50 ring-1 ring-inset ring-emerald-600" : "border-zinc-200 hover:border-emerald-200 hover:bg-emerald-50/50"
                )}
              >
                <span className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", kind === v ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700")}>
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-800">{label}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span>
                </span>
              </button>
            ))}
          </div>

          {kind === "table" ? (
            <div className="max-h-72 overflow-auto rounded-xl border border-zinc-200">
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 bg-zinc-50">
                  <tr>
                    {table.columns.map((c) => (
                      <th key={c.key} className="whitespace-nowrap border-b border-zinc-200 px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((v, j) => (
                        <td
                          key={j}
                          className={clsx(
                            "whitespace-nowrap border-b border-zinc-100 px-3 py-1.5 text-zinc-700",
                            table.columns[j]?.numeric && "text-right tabular-nums"
                          )}
                        >
                          {formatValue(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(158px,1fr))]">
              {valueOptionsFor(table).map((opt) => {
                const isPicked = opt.column === picked.column && opt.aggregate === picked.aggregate;
                return (
                  <button
                    key={`${opt.aggregate}:${opt.column}`}
                    onClick={() => setPicked(opt)}
                    className={clsx(
                      "rounded-xl border p-3 text-left",
                      isPicked ? "border-emerald-600 bg-emerald-50 ring-1 ring-inset ring-emerald-600" : "border-zinc-200 hover:border-emerald-200 hover:bg-emerald-50/50"
                    )}
                  >
                    <span className={clsx("block text-[22px] font-semibold leading-tight tabular-nums", isPicked ? "text-emerald-800" : "text-zinc-800")}>
                      {formatValue(aggregateColumn(table, opt.column, opt.aggregate))}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">{valueLabel(t, table, opt.column, opt.aggregate)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-zinc-200 bg-zinc-50 px-5 py-3">
          <label className="flex items-center gap-2 text-[13px] text-zinc-700">
            {t.data.picker.target}
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-20 rounded-md border border-zinc-300 px-2 py-1 font-mono text-[13px] uppercase outline-none focus:border-emerald-500"
            />
          </label>
          <span className={clsx("text-xs", anchor && !overwrites ? "text-zinc-500" : "text-amber-700")}>
            {!anchor
              ? t.data.picker.invalidCell
              : overwrites
                ? t.data.picker.areaOverwrite(extent.rows, extent.cols)
                : t.data.picker.area(extent.rows, extent.cols)}
          </span>
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="rounded-md border border-zinc-300 px-3.5 py-2 text-sm text-zinc-700 hover:bg-white">
              {t.data.picker.cancel}
            </button>
            <button
              onClick={insert}
              disabled={!anchor}
              className="rounded-md bg-emerald-600 px-4.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t.data.picker.insert}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
