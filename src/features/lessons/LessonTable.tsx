// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { parseCellRef } from "@/lib/formulaEngine/address";
import type { LessonTable as Computed } from "@/lib/lessons";

/**
 * A lesson's example table as the app would show it: column letters, row numbers, and each cell's
 * value — worked out by the engine, never typed in (see lessons.ts).
 *
 * Rendered on the server and never interactive. A real `<table>` with headers, so a screen reader
 * can say "C7, 450" rather than read a grid of numbers with no way to place them. The rows the
 * formula picks out are shaded, and the result cell is outlined; neither relies on colour alone —
 * a picked row's number carries a mark and the words "ตรงเงื่อนไข" for a screen reader, and the
 * result cell carries its formula as text.
 */
export default function LessonTable({
  columns,
  computed,
  result,
  picked = [],
  caption,
  formula,
}: {
  columns: string[];
  computed: Computed;
  /** The result cell's address, e.g. "C7". */
  result: string;
  picked?: number[];
  caption: string;
  formula: string;
}) {
  const at = parseCellRef(result);
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="border-collapse font-mono text-[13px] leading-snug text-ink">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <td className="w-8 border border-rule bg-band/60" />
            {columns.map((c) => (
              <th key={c} scope="col" className="min-w-[4.5rem] border border-rule bg-band/60 px-2 py-1 text-center text-[11.5px] font-medium text-ash">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {computed.display.map((row, r) => {
            const shaded = picked.includes(r + 1);
            return (
              <tr key={r} className={shaded ? "bg-ledger/[0.07]" : undefined}>
                <th
                  scope="row"
                  className={`border border-rule bg-band/60 px-2 py-1 text-center text-[11.5px] font-medium ${shaded ? "text-ledger-ink" : "text-ash"}`}
                >
                  {r + 1}
                  {shaded && (
                    <>
                      <span aria-hidden className="ml-0.5">
                        •
                      </span>
                      <span className="sr-only"> ตรงเงื่อนไข</span>
                    </>
                  )}
                </th>
                {row.map((value, c) => {
                  const isResult = at?.row === r && at.col === c;
                  const numeric = value !== "" && !Number.isNaN(Number(value));
                  return (
                    <td
                      key={c}
                      className={`border px-2 py-1 font-sans text-[13.5px] ${numeric ? "text-right tabular-nums" : ""} ${
                        isResult ? "border-2 border-ledger bg-white font-semibold" : "border-rule"
                      }`}
                    >
                      {value}
                      {isResult && <span className="sr-only"> (สูตร {formula})</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
