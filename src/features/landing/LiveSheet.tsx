"use client";

import { useMemo, useState } from "react";
import { parseFormula, FormulaSyntaxError } from "@/lib/formulaEngine/parser";
import { evaluate } from "@/lib/formulaEngine/evaluator";
import { colToLetters } from "@/lib/formulaEngine/address";
import { FormulaError, FormulaValue, isError } from "@/lib/formulaEngine/types";
import { useT } from "@/i18n";

/**
 * The hero of the landing page, and the one claim on it that cannot be faked: this grid is not a
 * screenshot. It imports the same parser and evaluator the app runs on, so every number in the
 * total column is computed in the visitor's browser as the page renders, and editing a price
 * recomputes the row and the total the way the real thing does.
 *
 * A spreadsheet product whose landing page shows a *picture* of a spreadsheet is asking to be
 * taken on trust. This asks for ten seconds instead. It also keeps itself honest: if the engine
 * regresses, the front page visibly breaks.
 *
 * Deliberately not the app's own grid component — that one carries selection ranges, formatting,
 * fill handles, clipboard and undo, none of which belong in a demo, and importing it would drag
 * the store onto a page that has no sheet.
 */

const ROWS = 6;
const COLS = 4;

/** Column D multiplies its row; the last row totals two columns. Everything else is typed-in data. */
const SEED: string[][] = [
  ["", "", "", ""],
  ["", "45", "12", "=B2*C2"],
  ["", "35", "8", "=B3*C3"],
  ["", "25", "20", "=B4*C4"],
  ["", "40", "6", "=B5*C5"],
  ["", "", "=SUM(C2:C5)", "=SUM(D2:D5)"],
];

function formatValue(v: FormulaValue): string {
  if (v === null || v === "") return "";
  if (isError(v)) return v.code;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") {
    return Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return v;
}

export default function LiveSheet() {
  const t = useT();
  const [cells, setCells] = useState<string[][]>(SEED);
  const [selected, setSelected] = useState<[number, number]>([1, 1]);
  const [editing, setEditing] = useState(false);

  // Labels are the only part of the sheet that gets translated; the figures are the same in both.
  const rowsWithText = useMemo(() => {
    const copy = cells.map((r) => [...r]);
    copy[0] = [...t.landing.demo.headers];
    t.landing.demo.items.forEach((name, i) => {
      if (copy[i + 1]) copy[i + 1][0] = name;
    });
    if (copy[5]) copy[5][0] = t.landing.demo.totalLabel;
    return copy;
  }, [cells, t]);

  /** One pass over the grid, memoised on the raw text — the same shape as the app's computeSheet,
   *  minus the cycle guard that a fixed six-row demo cannot need. */
  const computed = useMemo(() => {
    const getCell = (r: number, c: number): FormulaValue => {
      if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return null;
      const raw = rowsWithText[r]?.[c] ?? "";
      if (raw.startsWith("=") && raw.length > 1) {
        try {
          const res = evaluate(parseFormula(raw.slice(1)), { getCell });
          return res.kind === "scalar" ? res.value : (res.rows[0]?.[0] ?? null);
        } catch (e) {
          return new FormulaError(e instanceof FormulaSyntaxError ? "#SYNTAX!" : "#ERROR!");
        }
      }
      if (raw !== "" && !Number.isNaN(Number(raw))) return Number(raw);
      return raw === "" ? null : raw;
    };
    return Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => getCell(r, c)));
  }, [rowsWithText]);

  const [selRow, selCol] = selected;
  const selectedRaw = rowsWithText[selRow]?.[selCol] ?? "";
  const address = `${colToLetters(selCol)}${selRow + 1}`;
  const isFormula = selectedRaw.startsWith("=");

  /** Row 0 is the header and column A holds product names: both are text this page supplies in two
   *  languages, so letting them be edited would strand the visitor's typing on a language switch. */
  const editable = (r: number, c: number) => r > 0 && c > 0 && c < 3;

  const write = (r: number, c: number, value: string) => {
    setCells((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = value;
      return next;
    });
  };

  return (
    <div className="border border-rule bg-white">
      {/* Formula bar — the app's own, reduced to what a demo needs */}
      <div className="flex items-stretch border-b border-rule">
        <span className="tabular-nums flex w-14 shrink-0 items-center justify-center border-r border-rule bg-paper font-mono text-[11px] font-medium text-ash">
          {address}
        </span>
        <span className="flex w-8 shrink-0 items-center justify-center border-r border-rule font-mono text-[11px] italic text-ash">
          fx
        </span>
        <span className={`flex min-w-0 flex-1 items-center truncate px-3 py-2 font-mono text-[12.5px] ${isFormula ? "text-ledger" : "text-ink"}`}>
          {selectedRaw || <span className="text-ash/50">{t.landing.demo.emptyCell}</span>}
        </span>
      </div>

      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th className="w-9 border-b border-r border-rule bg-paper" />
            {Array.from({ length: COLS }, (_, c) => (
              <th
                key={c}
                className={`border-b border-rule px-2 py-1 font-mono text-[10px] font-medium text-ash ${c < COLS - 1 ? "border-r" : ""} ${
                  c === selCol ? "bg-band" : "bg-paper"
                }`}
              >
                {colToLetters(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROWS }, (_, r) => (
            <tr key={r} className={r > 0 && r % 2 === 0 ? "bg-band/70" : undefined}>
              <td
                className={`tabular-nums border-b border-r border-rule px-1 text-center font-mono text-[10px] text-ash ${
                  r === selRow ? "bg-band" : "bg-paper"
                }`}
              >
                {r + 1}
              </td>
              {Array.from({ length: COLS }, (_, c) => {
                const active = r === selRow && c === selCol;
                const raw = rowsWithText[r][c];
                const value = computed[r][c];
                const numeric = typeof value === "number";
                return (
                  <td
                    key={c}
                    onClick={() => {
                      setSelected([r, c]);
                      setEditing(false);
                    }}
                    onDoubleClick={() => editable(r, c) && setEditing(true)}
                    className={`relative cursor-cell border-b border-rule px-2 py-[7px] text-[13px] ${c < COLS - 1 ? "border-r" : ""} ${
                      r === 0 ? "bg-paper font-medium text-ink" : ""
                    } ${r === ROWS - 1 ? "font-semibold" : ""} ${numeric ? "tabular-nums text-right font-mono" : ""} ${
                      raw.startsWith("=") ? "text-ledger-ink" : "text-ink"
                    } ${active ? "outline outline-2 -outline-offset-2 outline-ledger" : ""}`}
                  >
                    {active && editing ? (
                      <input
                        autoFocus
                        defaultValue={raw}
                        onBlur={(e) => {
                          write(r, c, e.target.value);
                          setEditing(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") {
                            e.currentTarget.value = raw;
                            e.currentTarget.blur();
                          }
                        }}
                        className="absolute inset-0 w-full bg-white px-2 text-right font-mono text-[13px] outline-none"
                      />
                    ) : (
                      formatValue(value)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="border-t border-rule bg-paper px-3 py-2 text-[11.5px] leading-relaxed text-ash">
        {t.landing.demo.hint}
      </p>
    </div>
  );
}
