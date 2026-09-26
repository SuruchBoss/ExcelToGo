// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { useSheetStore } from "./sheetStore";

/**
 * `Ctrl+Enter`: one cell's content into everything selected, in one undo step.
 *
 * Tested at the store rather than through the key, because the key is two lines of routing and
 * this is the part with rules in it — which cells get written, what happens to the references
 * inside a formula, and what a template refuses.
 */
const select = (startRow: number, startCol: number, endRow: number, endCol: number) =>
  useSheetStore.getState().setSelection({ startRow, startCol, endRow, endCol, anchorRow: startRow, anchorCol: startCol });

const raw = (row: number, col: number) => useSheetStore.getState().sheets[0].sheet.cells[row][col];

beforeEach(() => {
  useSheetStore.getState().startBlank();
});

describe("filling a selection from the cell the cursor is on", () => {
  it("copies a value into every cell of the selection", () => {
    useSheetStore.getState().setCellRaw(0, 0, "ยังไม่จ่าย");
    select(0, 0, 3, 1);
    useSheetStore.getState().fillSelectionFromAnchor();

    expect(raw(3, 1)).toBe("ยังไม่จ่าย");
    expect(raw(1, 0)).toBe("ยังไม่จ่าย");
    expect(raw(4, 0)).toBe("");
  });

  it("shifts the references in a formula the way a drag-fill does", () => {
    // A column of the same wrong number is the failure worth avoiding: a formula that keeps
    // pointing at the original row looks filled and is not.
    useSheetStore.getState().setCellRaw(0, 2, "=A1*2");
    select(0, 2, 2, 2);
    useSheetStore.getState().fillSelectionFromAnchor();

    expect(raw(1, 2)).toBe("=A2*2");
    expect(raw(2, 2)).toBe("=A3*2");
  });

  it("does nothing at all when only one cell is selected", () => {
    // Not a silent no-op for its own sake: the work would push an undo step that changes nothing,
    // and Ctrl+Z would then appear not to work.
    useSheetStore.getState().setCellRaw(0, 0, "x");
    const before = useSheetStore.temporal.getState().pastStates.length;
    select(0, 0, 0, 0);
    useSheetStore.getState().fillSelectionFromAnchor();
    expect(useSheetStore.temporal.getState().pastStates.length).toBe(before);
  });

  it("is one step to undo, however many cells it wrote", () => {
    useSheetStore.getState().setCellRaw(0, 0, "ก");
    const before = useSheetStore.temporal.getState().pastStates.length;
    select(0, 0, 5, 3);
    useSheetStore.getState().fillSelectionFromAnchor();
    expect(useSheetStore.temporal.getState().pastStates.length).toBe(before + 1);

    useSheetStore.temporal.getState().undo();
    expect(raw(5, 3)).toBe("");
    expect(raw(0, 0)).toBe("ก");
  });

  it("says what it did, because most of what it changed is off the cursor", () => {
    useSheetStore.getState().setCellRaw(0, 0, "ก");
    select(0, 0, 4, 0);
    useSheetStore.getState().fillSelectionFromAnchor();
    expect(useSheetStore.getState().announcement?.text).toBeTruthy();
  });
});
