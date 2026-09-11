"use client";

import { useMemo } from "react";
import { BarChart3, ChartLine, ChartPie, Trash2 } from "lucide-react";
import clsx from "clsx";
import { chartDataFrom, ChartKind, ChartSpec, seriesColor } from "@/lib/charts";
import { rangeRefString } from "@/lib/formulaEngine/address";
import { selectActiveSelection, selectActiveSheet, useComputedSheet, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import ChartView from "./ChartView";

const NO_CHARTS: ChartSpec[] = [];

const KINDS: { kind: ChartKind; Icon: typeof BarChart3 }[] = [
  { kind: "bar", Icon: BarChart3 },
  { kind: "line", Icon: ChartLine },
  { kind: "pie", Icon: ChartPie },
];

export default function ChartPanel() {
  const t = useT();
  const sheet = useSheetStore(selectActiveSheet);
  const selection = useSheetStore(selectActiveSelection);
  const { values } = useComputedSheet();
  const addChart = useSheetStore((s) => s.addChart);
  const removeChart = useSheetStore((s) => s.removeChart);
  const setChartKind = useSheetStore((s) => s.setChartKind);

  // `?? []` creates a new array each render, which would make the memo below recompute every
  // time; keeping the fallback stable is what lets an untouched chart skip redrawing.
  const charts = sheet.charts ?? NO_CHARTS;
  const rangeLabel = rangeRefString(selection.startRow, selection.startCol, selection.endRow, selection.endCol);

  // Every chart redraws from the current values, so editing a cell moves the bars on the same
  // render. Memoised together because they all read the one computed grid.
  const drawn = useMemo(() => charts.map((c) => ({ chart: c, data: chartDataFrom(values, c.range) })), [charts, values]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
          <BarChart3 size={15} className="text-emerald-700" />
          {t.charts.title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t.charts.subtitle}</p>
      </div>

      <div className="rounded-lg border border-zinc-200 p-3">
        <p className="text-xs font-medium text-emerald-800">{t.charts.fromRange(rangeLabel)}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{t.charts.rangeHint}</p>
        <div className="mt-2 flex gap-1.5">
          {KINDS.map(({ kind, Icon }) => (
            <button
              key={kind}
              type="button"
              onClick={() => addChart(kind)}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-2 text-xs font-semibold text-white hover:bg-emerald-800 sm:min-h-0 sm:py-2"
            >
              <Icon size={14} /> {t.charts.kinds[kind]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <span className="text-xs font-medium text-zinc-600">{t.charts.count(charts.length)}</span>
        {charts.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-3 text-xs text-zinc-500">{t.charts.empty}</p>
        ) : (
          drawn.map(({ chart, data }) => (
            <div key={chart.id} className="rounded-lg border border-zinc-200 p-2">
              <div className="mb-1 flex items-center gap-1">
                <span className="truncate text-xs font-medium text-zinc-700">
                  {rangeRefString(chart.range.startRow, chart.range.startCol, chart.range.endRow, chart.range.endCol)}
                </span>
                <div className="flex-1" />
                {KINDS.map(({ kind, Icon }) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setChartKind(chart.id, kind)}
                    title={t.charts.kinds[kind]}
                    className={clsx(
                      "rounded p-1",
                      chart.kind === kind ? "bg-emerald-100 text-emerald-800" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    )}
                  >
                    <Icon size={13} />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => removeChart(chart.id)}
                  title={t.charts.remove}
                  className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <ChartView kind={chart.kind} data={data} emptyMessage={t.charts.noNumbers} />

              {/* A legend only earns its space once there is more than one series to tell apart. */}
              {data.series.length > 1 && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {data.series.map((s, i) => (
                    <span key={s.name + i} className="flex items-center gap-1 text-[11px] text-zinc-600">
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: seriesColor(i) }} />
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
