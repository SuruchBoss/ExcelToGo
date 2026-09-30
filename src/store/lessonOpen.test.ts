// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { undoSheet, useSheetStore } from "./sheetStore";

/**
 * "ลองในตาราง" on a formula page (#149) opens the lesson's example the way a file opens: added after
 * the work that is there, or in place of an empty workbook, and taken back out by one undo.
 */
const state = () => useSheetStore.getState();

beforeEach(() => {
  state().startBlank();
  useSheetStore.temporal.getState().clear();
});

describe("opening a lesson's example", () => {
  it("in place of an empty workbook, with the cursor on the cell the page was about", () => {
    state().openLesson("sumif", "replace");
    const tab = state().sheets.find((t) => t.id === state().activeSheetId)!;
    expect(state().sheets).toHaveLength(1);
    expect(tab.name).toBe("ลอง SUMIF");
    expect(tab.sheet.cells[6][2]).toBe('=SUMIF(A2:A6,"เหนือ",C2:C6)');
    expect(state().selectionBySheetId[tab.id]).toMatchObject({ anchorRow: 6, anchorCol: 2 });
    expect(state().importNotice).toEqual({ sheets: 1, mode: "replace", lesson: "SUMIF" });
  });

  it("after the work that is open, which stays as it was, and one undo takes it back out", () => {
    state().setCellRaw(0, 0, "งานของฉัน");
    state().openLesson("vlookup", "append");
    expect(state().sheets.map((t) => t.name)).toEqual([state().sheets[0].name, "ลอง VLOOKUP"]);
    expect(state().sheets[0].sheet.cells[0][0]).toBe("งานของฉัน");
    undoSheet();
    expect(state().sheets).toHaveLength(1);
    expect(state().sheets[0].sheet.cells[0][0]).toBe("งานของฉัน");
  });

  it("does nothing for a name no lesson has", () => {
    const before = state().sheets;
    state().openLesson("not-a-lesson", "replace");
    state().openLesson("SUMIF", "replace");
    expect(state().sheets).toBe(before);
  });
});
