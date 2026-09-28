// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { computeTab, useSheetStore } from "./sheetStore";

/**
 * Everything the store computes, it computes against the whole workbook (#58).
 *
 * The grid read other tabs; the pivot, the sort, the filter's announcement and the three exports
 * each called `computeSheet(sheet)` bare, so a cell showing 70 on screen was `#REF!` in the CSV and
 * a blank row in the pivot. Tested through the store actions, with the value on another sheet.
 */
const state = () => useSheetStore.getState();
const select = (r1: number, c1: number, r2 = r1, c2 = c1) =>
  state().setSelection({ startRow: r1, startCol: c1, endRow: r2, endCol: c2, anchorRow: r1, anchorCol: c1 });

beforeEach(() => {
  state().startBlank();
  useSheetStore.temporal.getState().clear();
  // Sheet1 holds one number; Sheet2 is a small table whose middle row reads it.
  state().setCellRaw(0, 0, "70");
  state().addSheet();
  const cells: [number, number, string][] = [
    [0, 0, "branch"],
    [0, 1, "sales"],
    [1, 0, "north"],
    [1, 1, "100"],
    [2, 0, "south"],
    [2, 1, "=Sheet1!A1"],
    [3, 0, "east"],
    [3, 1, "5.3"],
  ];
  for (const [r, c, raw] of cells) state().setCellRaw(r, c, raw);
});

describe("the store computes with the workbook (#58)", () => {
  it("a pivot over a source that reads another sheet counts that value", () => {
    select(0, 0, 3, 1);
    expect(state().buildPivotSheet({ rowFields: [0], colField: null, valueField: 1, agg: "sum" })).toBe(true);
    const pivot = state().sheets[state().sheets.length - 1].sheet;
    const values = computeTab(pivot, state().sheets).values;
    const south = values.findIndex((row) => row[0] === "south");
    expect(values[south][1]).toBe(70);
    expect(values.some((row) => row[1] === 175.3)).toBe(true);
  });

  it("a sort orders a cross-sheet value by its number, not as #REF!", () => {
    select(1, 1);
    state().sortSelection(false);
    const cells = state().sheets[1].sheet.cells;
    expect([cells[1][0], cells[2][0], cells[3][0]]).toEqual(["north", "south", "east"]);
    state().sortSelection(true);
    const after = state().sheets[1].sheet.cells;
    expect([after[1][0], after[2][0], after[3][0]]).toEqual(["east", "south", "north"]);
  });
});

/** Nothing outside the engine computes a sheet bare; `computeTab` is the one way in. */
describe("no bare computeSheet outside the engine (#58)", () => {
  it("finds computeSheet( only in the engine, its tests and computeTab", () => {
    const root = join(__dirname, "..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(path);
      }
    };
    walk(root);
    const calls: string[] = [];
    for (const file of files) {
      const rel = relative(root, file);
      if (rel === join("lib", "sheetCompute.ts")) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const code = line.trim();
          if (code.startsWith("*") || code.startsWith("//")) return;
          if (/\bcomputeSheet\(/.test(code)) calls.push(`${rel}:${i + 1}: ${code}`);
        });
    }
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^store\/sheetStore\.ts:\d+: return computeSheet\(sheet, createWorkbookResolver\(/);
  });
});
