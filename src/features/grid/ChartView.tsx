"use client";

import { ChartData, ChartKind } from "@/lib/charts";
import { chartMarks, ChartMark, fitBox } from "@/lib/chartGeometry";

/**
 * Draws a chart as plain SVG.
 *
 * No charting library: a bar, line and pie between them are a few dozen lines of geometry, against
 * a dependency that would outweigh the whole feature in the bundle. SVG also stays crisp when the
 * page is zoomed.
 *
 * The geometry itself lives in chartGeometry.ts, not here, because exporting a chart into an .xlsx
 * or a PDF has to draw the same picture without React — a chart on a sheet nobody is looking at was
 * never mounted, so there is no DOM node to copy. This component only turns marks into elements.
 *
 * The viewBox is built from the box the chart has been given rather than being fixed, so a chart
 * dragged wider grows more room for bars instead of the same drawing floating in more white space —
 * a fixed viewBox letterboxes, which makes resizing look like it did nothing.
 */

const DEFAULT_W = 320;
const DEFAULT_H = 190;

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-zinc-300 px-3 text-center text-xs text-zinc-500">
      {message}
    </div>
  );
}

function Mark({ mark }: { mark: ChartMark }) {
  switch (mark.shape) {
    case "line":
      return <line x1={mark.x1} y1={mark.y1} x2={mark.x2} y2={mark.y2} stroke={mark.stroke} strokeWidth={mark.width} />;
    case "rect":
      return <rect x={mark.x} y={mark.y} width={mark.w} height={mark.h} fill={mark.fill} rx={mark.rx} />;
    case "text":
      return (
        <text x={mark.x} y={mark.y} textAnchor={mark.anchor} fontSize={mark.size} fill={mark.fill}>
          {mark.text}
        </text>
      );
    case "polyline":
      return <polyline points={mark.points} fill="none" stroke={mark.stroke} strokeWidth={mark.width} strokeLinejoin="round" />;
    case "circle":
      return <circle cx={mark.cx} cy={mark.cy} r={mark.r} fill={mark.fill} />;
    case "path":
      return <path d={mark.d} fill={mark.fill} stroke={mark.stroke} strokeWidth={mark.strokeWidth} />;
  }
}

export default function ChartView({
  kind,
  data,
  emptyMessage,
  // Default for a chart given a width and told to keep its shape. A chart on the grid is inside a
  // box the user sized, and fills it instead.
  className = "h-auto w-full",
  width = DEFAULT_W,
  height = DEFAULT_H,
  seriesIndex = 0,
}: {
  kind: ChartKind;
  data: ChartData;
  emptyMessage: string;
  className?: string;
  width?: number;
  height?: number;
  /** Which series a pie draws; bar and line show every series and ignore it. */
  seriesIndex?: number;
}) {
  if (data.series.length === 0 || data.labels.length === 0) return <EmptyChart message={emptyMessage} />;

  const box = fitBox(width, height);
  const marks = chartMarks(kind, data, box, seriesIndex);
  if (marks.length === 0) return <EmptyChart message={emptyMessage} />;

  return (
    <svg viewBox={`0 0 ${box.w} ${box.h}`} className={className} role="img">
      {marks.map((mark, i) => (
        <Mark key={i} mark={mark} />
      ))}
    </svg>
  );
}
