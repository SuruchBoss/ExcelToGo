// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { computeTab, useSheetStore } from "./sheetStore";

/**
 * A pivot grouped by day (#45). A date's value is its serial now, and grouping by value would head
 * each row 45306; the pivot groups by the date as the grid shows it.
 */
const state = () => useSheetStore.getState();

beforeEach(() => {
  state().startBlank();
  const cells: [number, number, string][] = [
    [0, 0, "day"],
    [0, 1, "sales"],
    [1, 0, "2024-01-15"],
    [1, 1, "10"],
    [2, 0, "2024-01-16"],
    [2, 1, "20"],
    [3, 0, "2024-01-15"],
    [3, 1, "5"],
  ];
  for (const [r, c, raw] of cells) state().setCellRaw(r, c, raw);
});

describe("a pivot by date (#45)", () => {
  it("heads its rows with the dates, and totals each day", () => {
    state().setSelection({ startRow: 0, startCol: 0, endRow: 3, endCol: 1, anchorRow: 0, anchorCol: 0 });
    expect(state().buildPivotSheet({ rowFields: [0], colField: null, valueField: 1, agg: "sum" })).toBe(true);
    const pivot = state().sheets[state().sheets.length - 1].sheet;
    const { values, display } = computeTab(pivot, state().sheets);
    const at = (label: string) => display.findIndex((r) => r[0] === label);
    expect(values[at("2024-01-15")][1]).toBe(15);
    expect(values[at("2024-01-16")][1]).toBe(20);
    // The heading is the date itself, so in the pivot it is a date again, not a number shown as one.
    expect(values[at("2024-01-15")][0]).toBe(45306);
    expect(display.some((r) => r[0] === "45306")).toBe(false);
  });
});
