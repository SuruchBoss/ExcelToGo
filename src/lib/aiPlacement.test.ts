// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { placeFormula, readsItself } from "./aiPlacement";

/**
 * Where Insert puts an answer (#64). The grid is column E of the sample: a header, nine formulas,
 * an empty row 11 and the grand total in row 12.
 */
const cells: Record<string, string> = { "0,4": "Total", "11,4": "=SUM(E2:E10)" };
for (let r = 1; r <= 9; r++) cells[`${r},4`] = `=C${r + 1}*D${r + 1}`;
const rawAt = (r: number, c: number) => cells[`${r},${c}`] ?? "";

describe("where an answer goes (#64)", () => {
  it("an empty cursor cell the formula does not read", () => {
    expect(placeFormula("=SUM(E2:E10)", { row: 10, col: 4 }, rawAt, 30)).toEqual({ row: 10, col: 4 });
  });

  it("from inside the column, under it — not over E5's own formula", () => {
    expect(placeFormula("=SUM(E2:E10)", { row: 4, col: 4 }, rawAt, 30)).toEqual({ row: 10, col: 4 });
  });

  it("a filled cell it does not read, when there is nowhere better (the panel warns first)", () => {
    expect(placeFormula("=UPPER(A5)", { row: 4, col: 4 }, rawAt, 30)).toEqual({ row: 4, col: 4 });
  });

  it("nowhere, when the only cell it could go into is one it reads", () => {
    expect(placeFormula("=SUM(F2)", { row: 1, col: 5 }, rawAt, 30)).toBeNull();
    expect(placeFormula("=VLOOKUP(A2,F2:G21,2,FALSE)", { row: 1, col: 5 }, rawAt, 30)).toBeNull();
    // Under the column is the grand total's row when the range runs to row 11: filled, so not there.
    expect(placeFormula("=SUM(E2:E11)", { row: 4, col: 4 }, rawAt, 30)).toBeNull();
  });

  it("sees a cell inside a range too big to highlight, which a capped cell set would miss", () => {
    expect(readsItself("=SUM(A1:A100000)", { row: 50_000, col: 0 })).toBe(true);
    expect(readsItself("=SUM(A1:A100000)", { row: 5, col: 1 })).toBe(false);
  });
});
