"use client";

import { ChartData, ChartKind, seriesColor, valueExtent } from "@/lib/charts";

/**
 * Draws a chart as plain SVG.
 *
 * No charting library: a bar, line and pie between them are a few dozen lines of geometry, against
 * a dependency that would outweigh the whole feature in the bundle. SVG also scales to whatever
 * width the panel has without a resize observer, and stays crisp when the page is zoomed.
 */

const W = 320;
const H = 190;
const PAD = { top: 8, right: 8, bottom: 30, left: 38 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Formats an axis number compactly — a full 1,250,000 would collide with its neighbours. */
function axisLabel(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(v * 100) / 100);
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-zinc-300 px-3 text-center text-xs text-zinc-500">
      {message}
    </div>
  );
}

export default function ChartView({ kind, data, emptyMessage }: { kind: ChartKind; data: ChartData; emptyMessage: string }) {
  if (data.series.length === 0 || data.labels.length === 0) return <EmptyChart message={emptyMessage} />;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
      {kind === "pie" ? <Pie data={data} /> : <Axes kind={kind} data={data} />}
    </svg>
  );
}

/** Bar and line share an axis frame, and differ only in what they draw inside it. */
function Axes({ kind, data }: { kind: ChartKind; data: ChartData }) {
  const { min, max } = valueExtent(data.series);
  const y = (v: number) => PAD.top + PLOT_H - ((v - min) / (max - min)) * PLOT_H;
  const slot = PLOT_W / data.labels.length;
  const zeroY = y(0);

  // Labels thin out rather than overlap once there are more than the width can hold.
  const labelStep = Math.ceil(data.labels.length / 6);

  return (
    <>
      {[min, min + (max - min) / 2, max].map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#e4e4e7" strokeWidth={1} />
          <text x={PAD.left - 4} y={y(v) + 3} textAnchor="end" fontSize={8} fill="#71717a">
            {axisLabel(v)}
          </text>
        </g>
      ))}
      {/* Zero is drawn darker than the other gridlines: with negative values it is the baseline
          bars hang from, and without it the chart reads as if everything were positive. */}
      {min < 0 && <line x1={PAD.left} x2={W - PAD.right} y1={zeroY} y2={zeroY} stroke="#a1a1aa" strokeWidth={1} />}

      {data.labels.map((label, i) =>
        i % labelStep === 0 ? (
          <text key={i} x={PAD.left + slot * (i + 0.5)} y={H - 14} textAnchor="middle" fontSize={8} fill="#71717a">
            {label.length > 8 ? label.slice(0, 7) + "…" : label}
          </text>
        ) : null
      )}

      {kind === "bar"
        ? data.series.map((s, si) => {
            const barW = (slot * 0.7) / data.series.length;
            return s.points.map((p, i) =>
              p === null ? null : (
                <rect
                  key={`${si}-${i}`}
                  x={PAD.left + slot * (i + 0.15) + barW * si}
                  y={Math.min(y(p), zeroY)}
                  width={barW}
                  height={Math.max(1, Math.abs(zeroY - y(p)))}
                  fill={seriesColor(si)}
                  rx={1}
                />
              )
            );
          })
        : data.series.map((s, si) => {
            // A gap in the data breaks the line rather than drawing a straight run through it,
            // which would invent readings that were never there.
            const runs: string[] = [];
            let current: string[] = [];
            s.points.forEach((p, i) => {
              if (p === null) {
                if (current.length > 1) runs.push(current.join(" "));
                current = [];
                return;
              }
              current.push(`${PAD.left + slot * (i + 0.5)},${y(p)}`);
            });
            if (current.length > 1) runs.push(current.join(" "));
            return (
              <g key={si}>
                {runs.map((points, ri) => (
                  <polyline key={ri} points={points} fill="none" stroke={seriesColor(si)} strokeWidth={2} strokeLinejoin="round" />
                ))}
                {s.points.map((p, i) =>
                  p === null ? null : <circle key={i} cx={PAD.left + slot * (i + 0.5)} cy={y(p)} r={2.5} fill={seriesColor(si)} />
                )}
              </g>
            );
          })}
    </>
  );
}

/** A pie shows one series — the first — because several would have to be nested to fit. */
function Pie({ data }: { data: ChartData }) {
  const points = data.series[0].points.map((p) => (p === null ? 0 : Math.max(0, p)));
  const total = points.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(PLOT_H, PLOT_W) / 2 - 2;

  // Angles are accumulated up front rather than inside the map: a render callback that mutates a
  // variable it captured is exactly what React's compiler rules out, and the slices are easier to
  // read as data anyway.
  const slices: { index: number; from: number; sweep: number }[] = [];
  let cursor = -Math.PI / 2;
  for (let i = 0; i < points.length; i++) {
    const sweep = (points[i] / total) * Math.PI * 2;
    if (points[i] > 0) slices.push({ index: i, from: cursor, sweep });
    cursor += sweep;
  }

  return (
    <>
      {slices.map(({ index, from, sweep }) => {
        // A slice covering everything cannot be drawn as an arc — its start and end points are the
        // same, so the path collapses to nothing. It is a full circle instead.
        if (sweep >= Math.PI * 2 - 1e-9) return <circle key={index} cx={cx} cy={cy} r={r} fill={seriesColor(index)} />;
        const to = from + sweep;
        const x1 = cx + r * Math.cos(from);
        const y1 = cy + r * Math.sin(from);
        const x2 = cx + r * Math.cos(to);
        const y2 = cy + r * Math.sin(to);
        const large = sweep > Math.PI ? 1 : 0;
        return (
          <path
            key={index}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
            fill={seriesColor(index)}
            stroke="#ffffff"
            strokeWidth={1}
          />
        );
      })}
    </>
  );
}
