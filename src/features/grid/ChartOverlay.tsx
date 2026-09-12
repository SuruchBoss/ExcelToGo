"use client";

import { useState } from "react";
import { BarChart3, ChartLine, ChartPie, GripHorizontal, Trash2 } from "lucide-react";
import clsx from "clsx";
import {
  ChartFrame,
  ChartKind,
  ChartSpec,
  chartDataFrom,
  clampFrame,
  moveFrame,
  legendEntries,
  resizeFrame,
} from "@/lib/charts";
import { autoChartFrame, contentSize } from "@/lib/gridGeometry";
import { rangeRefString } from "@/lib/formulaEngine/address";
import { FormulaValue } from "@/lib/formulaEngine/types";
import { SheetModel } from "@/lib/sheet";
import { useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import ChartView from "./ChartView";

/**
 * Charts floating over the cells, draggable by their bar and resizable from the bottom corner.
 *
 * They live inside the grid's scroll container, so they sit in the sheet's own coordinates and
 * scroll with the rows they were put beside — a chart pinned to the viewport would drift away from
 * its numbers the moment anyone scrolled.
 */

/** Border and body padding, and on top of that the drag bar, measured off the card's own markup. */
const CARD_CHROME_W = 14;
const CARD_CHROME_H = 40;
/** The one-line legend under a multi-series chart, which the drawing has to make room for. */
const LEGEND_H = 16;

const KINDS: { kind: ChartKind; Icon: typeof BarChart3 }[] = [
  { kind: "bar", Icon: BarChart3 },
  { kind: "line", Icon: ChartLine },
  { kind: "pie", Icon: ChartPie },
];

/** A drag in progress: where it started, and the frame it started from. */
interface Gesture {
  id: string;
  mode: "move" | "resize";
  pointerX: number;
  pointerY: number;
  from: ChartFrame;
  /** Where the frame has got to — shown live, written to the store only when the drag ends. */
  live: ChartFrame;
}

export default function ChartOverlay({
  sheet,
  values,
  hiddenRows,
}: {
  sheet: SheetModel;
  values: FormulaValue[][];
  hiddenRows: ReadonlySet<number>;
}) {
  const t = useT();
  const removeChart = useSheetStore((s) => s.removeChart);
  const setChartKind = useSheetStore((s) => s.setChartKind);
  const moveChart = useSheetStore((s) => s.moveChart);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  // Which chart was touched last, so overlapping charts can be brought forward by clicking them.
  // Deliberately not stored with the sheet: it says nothing about the document.
  const [front, setFront] = useState<string | null>(null);

  const charts = sheet.charts;
  if (!charts || charts.length === 0) return null;

  const canvas = contentSize(sheet, hiddenRows);
  const frameOf = (chart: ChartSpec): ChartFrame =>
    gesture?.id === chart.id ? gesture.live : chart.frame ?? autoChartFrame(sheet, chart.range, hiddenRows);

  const begin = (chart: ChartSpec, mode: Gesture["mode"]) => (e: React.PointerEvent) => {
    // The grid starts a cell selection on mousedown anywhere inside it, and touch would scroll the
    // sheet instead of moving the chart; both have to be stopped for a drag to mean anything.
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const from = frameOf(chart);
    setFront(chart.id);
    setGesture({ id: chart.id, mode, pointerX: e.clientX, pointerY: e.clientY, from, live: from });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!gesture) return;
    const dx = e.clientX - gesture.pointerX;
    const dy = e.clientY - gesture.pointerY;
    const moved = gesture.mode === "move" ? moveFrame(gesture.from, dx, dy) : resizeFrame(gesture.from, dx, dy);
    setGesture({ ...gesture, live: clampFrame(moved, canvas) });
  };

  const end = () => {
    if (gesture) moveChart(gesture.id, gesture.live);
    setGesture(null);
  };

  return (
    <>
      {charts.map((chart) => {
        const f = frameOf(chart);
        const data = chartDataFrom(values, chart.range);
        const legend = legendEntries(chart.kind, data);
        return (
          <div
            key={chart.id}
            onPointerDown={() => setFront(chart.id)}
            className="absolute flex flex-col overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg"
            style={{
              left: f.x,
              top: f.y,
              width: f.w,
              height: f.h,
              // Above the cells, below the sticky row and column headers (z-10 and up) so a chart
              // scrolled to the edge slides under them instead of hiding which row it is next to.
              zIndex: front === chart.id ? 6 : 5,
            }}
          >
            <div
              onPointerDown={begin(chart, "move")}
              onPointerMove={onPointerMove}
              onPointerUp={end}
              onPointerCancel={end}
              title={t.charts.move}
              className="flex cursor-move touch-none items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-1.5 py-1"
            >
              <GripHorizontal size={12} className="shrink-0 text-zinc-400" />
              <span className="truncate text-[11px] font-medium text-zinc-700">
                {rangeRefString(chart.range.startRow, chart.range.startCol, chart.range.endRow, chart.range.endCol)}
              </span>
              <div className="flex-1" />
              {KINDS.map(({ kind, Icon }) => (
                <button
                  key={kind}
                  type="button"
                  // The bar is a drag handle, so a press on a button inside it must not start one.
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setChartKind(chart.id, kind)}
                  title={t.charts.kinds[kind]}
                  className={clsx(
                    "rounded p-1",
                    chart.kind === kind ? "bg-emerald-100 text-emerald-800" : "text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                  )}
                >
                  <Icon size={12} />
                </button>
              ))}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => removeChart(chart.id)}
                title={t.charts.remove}
                className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-1.5">
              <ChartView
                kind={chart.kind}
                data={data}
                emptyMessage={t.charts.noNumbers}
                className="min-h-0 w-full flex-1"
                // The drawing is given the box's own proportions so it fills the card instead of
                // being letterboxed inside it; a few pixels out only costs a hairline margin.
                width={f.w - CARD_CHROME_W}
                height={f.h - CARD_CHROME_H - (legend.length > 0 ? LEGEND_H : 0)}
              />
              {/* Colours nobody can name are decoration; what they stand for depends on the kind,
                  which is why the list is worked out in charts.ts rather than here. */}
              {legend.length > 0 && (
                <div className="mt-0.5 flex max-h-8 flex-wrap gap-x-2.5 gap-y-0.5 overflow-hidden px-0.5">
                  {legend.map((entry, i) => (
                    <span
                      key={entry.label + i}
                      className="flex items-center gap-1 text-[10px] leading-tight text-zinc-600"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
                      {entry.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div
              onPointerDown={begin(chart, "resize")}
              onPointerMove={onPointerMove}
              onPointerUp={end}
              onPointerCancel={end}
              title={t.charts.resize}
              // 20px rather than the 8px the corner mark suggests: a finger has no pixel to aim at.
              className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize touch-none"
            >
              <span className="pointer-events-none absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-zinc-400" />
            </div>
          </div>
        );
      })}
    </>
  );
}
