// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { selectHasWork, undoSheet, useSheetStore } from "./sheetStore";

/**
 * Opening a file over work used to replace the whole workbook without a word (blind test U6). The
 * dialog asks; these are the two answers it can give, and the rule for when it asks at all.
 */
const state = () => useSheetStore.getState();
const csv = (name: string, text: string) => new File([text], name, { type: "text/csv" });

beforeEach(() => {
  state().startBlank();
  useSheetStore.temporal.getState().clear();
});

describe("when the question is asked", () => {
  it("not over an empty workbook — there is nothing to lose", () => {
    expect(selectHasWork(state())).toBe(false);
  });

  it("over anything someone typed", () => {
    state().setCellRaw(0, 0, "งบเดือนตุลา");
    expect(selectHasWork(state())).toBe(true);
  });
});

describe("opening a file", () => {
  it("append keeps the work that was open and adds the file after it", async () => {
    state().setCellRaw(0, 0, "keep me");
    const before = state().sheets[0];
    await state().importFromFile(csv("Sales.csv", "a,b\n1,2"), "append");
    expect(state().sheets.map((t) => t.name)).toEqual([before.name, "Sales"]);
    expect(state().sheets[0].sheet.cells[0][0]).toBe("keep me");
    expect(state().activeSheetId).toBe(state().sheets[1].id);
    expect(state().importNotice).toEqual({ sheets: 1, mode: "append" });
  });

  it("append renames an incoming tab whose name is taken, never the one already open", async () => {
    const open = state().sheets[0].name;
    await state().importFromFile(csv(`${open}.csv`, "x"), "append");
    expect(state().sheets.map((t) => t.name)).toEqual([open, `${open} (2)`]);
  });

  it("replace swaps the workbook, and one undo brings the old one back", async () => {
    state().setCellRaw(0, 0, "keep me");
    await state().importFromFile(csv("Other.csv", "z"), "replace");
    expect(state().sheets.map((t) => t.name)).toEqual(["Other"]);
    expect(state().importNotice).toEqual({ sheets: 1, mode: "replace" });
    undoSheet();
    expect(state().sheets[0].sheet.cells[0][0]).toBe("keep me");
  });
});
