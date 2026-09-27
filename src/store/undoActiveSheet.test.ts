// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { redoSheet, undoSheet, useSheetStore } from "./sheetStore";

/**
 * Undo takes back the tab list; it must not take the open tab with it (#40).
 *
 * Undo history holds only `sheets`, so undoing "add sheet", an import or "start blank" can remove
 * the tab `activeSheetId` points at. Reads fell back to the first tab while writes went by id and
 * matched nothing, so everything typed afterwards vanished — no error, and still empty after a
 * reload. Tested at the store, through the same `undoSheet` the toolbar and Ctrl+Z call, because
 * the bug lived between the history and the actions rather than in either one.
 */
const state = () => useSheetStore.getState();
const activeCells = () => state().sheets.find((t) => t.id === state().activeSheetId)!.sheet.cells;
const history = () => useSheetStore.temporal.getState();

beforeEach(() => {
  state().startBlank();
  history().clear();
});

/** What the three flows in the report have in common: the open tab is one undo can remove. */
function expectEditsLandAfterUndo() {
  expect(state().sheets.some((t) => t.id === state().activeSheetId)).toBe(true);
  state().setCellRaw(1, 0, "important");
  expect(activeCells()[1][0]).toBe("important");
  // And it is in what autosave writes, which is what a reload reads back.
  const saved = state().sheets.find((t) => t.id === state().activeSheetId)!;
  expect(saved.sheet.cells[1][0]).toBe("important");
}

describe("an edit after undoing a change to the tab list is kept (#40)", () => {
  it("after undoing add sheet", () => {
    state().setCellRaw(0, 0, "first");
    state().addSheet();
    expect(state().sheets).toHaveLength(2);
    undoSheet();
    expect(state().sheets).toHaveLength(1);
    expectEditsLandAfterUndo();
    // The tab that is open is the one that is left, with its content.
    expect(activeCells()[0][0]).toBe("first");
  });

  it("after undoing an import", async () => {
    state().setCellRaw(0, 0, "before");
    await state().importFromFile(new File(["a,b\n1,2\n"], "data.csv", { type: "text/csv" }));
    expect(activeCells()[0][0]).toBe("a");
    undoSheet();
    expect(activeCells()[0][0]).toBe("before");
    expectEditsLandAfterUndo();
  });

  it("after undoing start blank", () => {
    state().setCellRaw(0, 0, "sample");
    state().startBlank();
    undoSheet();
    expect(activeCells()[0][0]).toBe("sample");
    expectEditsLandAfterUndo();
  });

  it("after a redo that brings the removed tab back, and an undo that takes it away again", () => {
    state().addSheet();
    undoSheet();
    redoSheet();
    expect(state().sheets).toHaveLength(2);
    undoSheet();
    expectEditsLandAfterUndo();
  });

  it("keeps the tab that was open when undo does not remove it", () => {
    state().addSheet();
    const second = state().activeSheetId;
    state().setCellRaw(0, 0, "x");
    undoSheet();
    expect(state().activeSheetId).toBe(second);
  });

  it("formats land too, not only typed values", () => {
    state().addSheet();
    undoSheet();
    state().setSelection({ startRow: 1, startCol: 0, endRow: 1, endCol: 0, anchorRow: 1, anchorCol: 0 });
    state().toggleBold();
    const tab = state().sheets.find((t) => t.id === state().activeSheetId)!;
    expect(tab.sheet.formats[1]?.[0]?.bold).toBe(true);
  });
});
