// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { singleCellSelection } from "@/types/sheet-ui";
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

afterEach(() => {
  vi.unstubAllGlobals();
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

  it("a template stays put on its last row, quietly: no row, no alert, no undo step", () => {
    // A template's structure is locked, so the row is refused, but this is an arrow key or Enter,
    // not Insert row: the "structure is locked" alert would pop up on every press.
    const alert = vi.fn();
    vi.stubGlobal("alert", alert);
    useSheetStore.setState((s) => ({
      sheets: s.sheets.map((t) =>
        t.id === s.activeSheetId ? { ...t, sheet: { ...t.sheet, template: { inputs: {}, choices: {} } } } : t
      ),
    }));
    history().clear();
    const before = state().sheets;
    expect(state().growRowForEntry()).toBe(false);
    expect(state().sheets).toBe(before);
    expect(alert).not.toHaveBeenCalled();
    expect(history().pastStates).toHaveLength(0);
  });
});

describe("the cursor stays on the sheet when undo or redo changes its size (#170 review)", () => {
  const selection = () => state().selectionBySheetId[state().activeSheetId];

  it("PO's repro: x1, Enter, x2, Enter, one undo puts the cursor back on the last row that exists", () => {
    const rows = sheet().rows;
    state().setSelection(singleCellSelection(rows - 1, 2));
    state().setCellRaw(rows - 1, 2, "x1");
    expect(state().growRowForEntry()).toBe(true);
    state().setSelection(singleCellSelection(rows, 2));
    state().setCellRaw(rows, 2, "x2");
    expect(state().growRowForEntry()).toBe(true);
    state().setSelection(singleCellSelection(rows + 1, 2));

    undoSheet();
    expect(sheet().rows).toBe(rows);
    expect(selection()).toEqual(singleCellSelection(rows - 1, 2));

    // And the sheet takes input there again: this is what the stuck grid could not do.
    state().setCellRaw(selection().anchorRow, selection().anchorCol, "y");
    expect(sheet().cells[rows - 1][2]).toBe("y");
  });

  it("a range that ran past the new edge is cut to it, and one inside is left alone", () => {
    const rows = sheet().rows;
    state().setCellRaw(rows - 1, 0, "a");
    expect(state().growRowForEntry()).toBe(true);
    state().setCellRaw(rows, 0, "b");
    state().setSelection({ anchorRow: rows - 2, anchorCol: 0, startRow: rows - 2, startCol: 0, endRow: rows, endCol: 1 });
    undoSheet();
    expect(selection()).toEqual({ anchorRow: rows - 2, anchorCol: 0, startRow: rows - 2, startCol: 0, endRow: rows - 1, endCol: 1 });

    const inside = singleCellSelection(3, 3);
    state().setSelection(inside);
    redoSheet();
    expect(selection()).toBe(inside);
  });

  it("an undone column pulls the cursor back in as well", () => {
    const cols = sheet().cols;
    state().addColumn();
    state().setSelection(singleCellSelection(0, cols));
    state().setCellRaw(0, cols, "z");
    undoSheet();
    undoSheet();
    expect(sheet().cols).toBe(cols);
    expect(selection()).toEqual(singleCellSelection(0, cols - 1));
  });
});

describe("a write that arrives for a cell undo took away (#191)", () => {
  it("is refused rather than thrown, and the sheet is left as it was", () => {
    const rows = sheet().rows;
    state().setCellRaw(rows - 1, 2, "x1");
    expect(state().growRowForEntry()).toBe(true);
    undoSheet();
    expect(sheet().rows).toBe(rows);
    const before = state().sheets;
    // The editor on the phone still held C31 here: its commit is the write that used to throw.
    expect(() => state().setCellRaw(rows, 2, "abc")).not.toThrow();
    expect(state().sheets).toBe(before);
    expect(() => state().setCellRaw(0, sheet().cols, "abc")).not.toThrow();
    expect(state().sheets).toBe(before);
  });
});

