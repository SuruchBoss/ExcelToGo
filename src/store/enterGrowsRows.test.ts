// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { redoSheet, undoSheet, useSheetStore } from "./sheetStore";

/**
 * Enter on the last row makes room instead of staying put (#170).
 *
 * A new sheet has 30 rows. Enter on row 30 used to leave the cursor where it was, so the next
 * value typed went over the one just entered and it was gone, with nothing to say so. The grid now
 * asks the store for one more row; these are the store's half: the row appears, nothing moves, and
 * one Ctrl+Z takes back the value typed there together with the row it needed.
 */
const state = () => useSheetStore.getState();
const sheet = () => state().sheets.find((t) => t.id === state().activeSheetId)!.sheet;
const history = () => useSheetStore.temporal.getState();

beforeEach(() => {
  state().startBlank();
  history().clear();
});

/** Enter on the last row as the grid does it: grow, then type into the new row. */
function typeBelowTheLastRow(col: number, raw: string) {
  const last = sheet().rows - 1;
  expect(state().growRowForEntry()).toBe(true);
  state().setCellRaw(last + 1, col, raw);
}

describe("Enter on the last row adds one (#170)", () => {
  it("the issue's steps: r30 then r31 both stay where they were typed", () => {
    const rows = sheet().rows;
    state().setCellRaw(rows - 1, 5, "r30");
    typeBelowTheLastRow(5, "r31");
    expect(sheet().rows).toBe(rows + 1);
    expect(sheet().cells[rows - 1][5]).toBe("r30");
    expect(sheet().cells[rows][5]).toBe("r31");
  });

  it("three rows typed past the end, each where it was put", () => {
    const rows = sheet().rows;
    state().setCellRaw(rows - 1, 0, "a");
    typeBelowTheLastRow(0, "b");
    typeBelowTheLastRow(0, "c");
    typeBelowTheLastRow(0, "d");
    expect(sheet().rows).toBe(rows + 3);
    expect([rows - 1, rows, rows + 1, rows + 2].map((r) => sheet().cells[r][0])).toEqual(["a", "b", "c", "d"]);
  });

  it("one undo takes back the value and the row it made room for; redo puts both back", () => {
    const rows = sheet().rows;
    state().setCellRaw(rows - 1, 5, "r30");
    typeBelowTheLastRow(5, "r31");
    undoSheet();
    expect(sheet().rows).toBe(rows);
    expect(sheet().cells[rows - 1][5]).toBe("r30");
    undoSheet();
    expect(sheet().cells[rows - 1][5]).toBe("");
    redoSheet();
    redoSheet();
    expect(sheet().rows).toBe(rows + 1);
    expect(sheet().cells[rows][5]).toBe("r31");
  });

  it("Enter twice before typing still undoes in one step", () => {
    const rows = sheet().rows;
    expect(state().growRowForEntry()).toBe(true);
    expect(state().growRowForEntry()).toBe(true);
    state().setCellRaw(rows + 1, 0, "x");
    undoSheet();
    expect(sheet().rows).toBe(rows);
  });

  it("a row added and never typed into is not an undo step of its own", () => {
    state().setCellRaw(0, 0, "kept");
    expect(state().growRowForEntry()).toBe(true);
    expect(history().pastStates).toHaveLength(1);
    undoSheet();
    expect(sheet().cells[0][0]).toBe("");
  });
});
