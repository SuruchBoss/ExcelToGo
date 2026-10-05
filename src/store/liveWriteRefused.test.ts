// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import type { TableData } from "@/lib/dataSources/types";
import { DEFAULT_SEARCH_OPTIONS } from "@/lib/sheetSearch";
import { useSheetStore } from "./sheetStore";

/**
 * Writes that reach a live block other than typing (#232).
 *
 * A paste into a live cell was written, said as pasted, and wiped by the next refresh, with Ctrl+Z
 * unable to bring it back. Fill, Ctrl+Enter, cut and delete were the same door. Each is refused
 * whole now, before anything changes, and says which cells refused, under the cell the cursor is on.
 */
const state = () => useSheetStore.getState();
const cells = () => state().sheets[0].sheet.cells;
const select = (startRow: number, startCol: number, endRow = startRow, endCol = startCol) =>
  state().setSelection({ startRow, startCol, endRow, endCol, anchorRow: startRow, anchorCol: startCol });

const TABLE: TableData = {
  columns: [
    { key: "sku", label: "sku", numeric: false },
    { key: "qty", label: "qty", numeric: true },
  ],
  rows: [
    ["CF-01", 10],
    ["CF-02", 20],
  ],
  fetchedAt: new Date(0).toISOString(),
};
const refresh = () => state().applyLiveData("sales", TABLE);
const REFUSED = /^(B2|B3|A2:B3|B2:B3) (เป็นข้อมูลสด|is live data)/;

let before: string[][];
beforeEach(() => {
  state().startBlank();
  state().clearClipboard();
  useSheetStore.temporal.getState().clear();
  // The block is A1:B3 (header + two rows); C2 and D2 are the person's own.
  select(0, 0);
  state().addLiveBlock({ sourceId: "sales", anchorRow: 0, anchorCol: 0, kind: "table" }, TABLE);
  state().setCellRaw(1, 2, "PASTED");
  state().setCellRaw(1, 3, "7");
  before = cells().map((row) => [...row]);
});

const unchanged = () => expect(cells().slice(0, 3).map((r) => r.slice(0, 4))).toEqual(before.slice(0, 3).map((r) => r.slice(0, 4)));

describe("a write that reaches live data is refused whole and said (#232)", () => {
  it("a paste of our own clipboard into a live cell: nothing written, nothing said as pasted, the note under the cell", () => {
    select(1, 2);
    state().copySelection();
    select(1, 1);
    state().pasteAtSelection();
    unchanged();
    expect(state().announcement?.text).toMatch(REFUSED);
    expect(state().refusal).toMatchObject({ row: 1, col: 1 });
    refresh();
    unchanged();
  });

  it("a paste from another program that starts outside the block and runs into it is refused, not applied around it", () => {
    select(1, 3);
    state().pasteAtSelection("a\tb\r\nc\td\r\n");
    // D2:E3 does not reach the block: it goes in.
    expect(cells()[1][3]).toBe("a");
    select(1, 0);
    state().pasteAtSelection("x\ty\r\nz\tw\r\n");
    expect(cells()[1].slice(0, 2)).toEqual(before[1].slice(0, 2));
    expect(state().announcement?.text).toMatch(/^A2:B3 /);
  });

  it("fill down, Ctrl+Enter, delete and cut over a range with live cells", () => {
    select(1, 1, 2, 2);
    state().fillWithinSelection("down");
    unchanged();
    // Fill down writes row 3 from row 2, so it is B3 that refuses.
    expect(state().announcement?.text).toMatch(/^B3 /);

    state().fillSelectionFromAnchor();
    unchanged();

    state().clearSelection();
    unchanged();
    expect(state().announcement?.text).toMatch(REFUSED);

    state().cutSelection();
    expect(state().clipboard).toBeNull();
    expect(state().announcement?.text).toMatch(REFUSED);
  });

  it("anything else that writes a cell, such as the AI assistant: refused with the note", () => {
    state().setCellRaw(1, 1, "=1+1");
    unchanged();
    expect(state().refusal).toMatchObject({ row: 1, col: 1 });
    expect(state().announcement?.text).toMatch(REFUSED);
  });

  it("says it once while the same note stays up, and a write outside the block still goes in", () => {
    select(1, 1);
    state().pasteAtSelection("x");
    const seq = state().announcement?.seq;
    state().pasteAtSelection("y");
    expect(state().announcement?.seq).toBe(seq);
    select(4, 4);
    state().pasteAtSelection("free");
    expect(cells()[4][4]).toBe("free");
  });

  it("a paste over a template's structure says so the same way, instead of a browser alert", () => {
    useSheetStore.setState((st) => ({
      sheets: st.sheets.map((t) =>
        t.id === st.activeSheetId ? { ...t, liveBlocks: [], sheet: { ...t.sheet, template: { inputs: { "5,0": true }, choices: {} } } } : t
      ),
    }));
    select(5, 0);
    state().pasteAtSelection("one\r\ntwo\r\n");
    expect(cells()[5][0]).toBe("");
    expect(state().announcement?.text).toMatch(/^A7 (เป็นโครงของแม่แบบ|is part of the template)/);
    expect(state().refusal).toMatchObject({ row: 5, col: 0 });
  });

  it("replace all leaves live cells alone and replaces the person's own", () => {
    state().setCellRaw(4, 0, "CF-01");
    expect(state().replaceAll("CF-01", "X", DEFAULT_SEARCH_OPTIONS)).toBe(1);
    expect(cells()[1][0]).toBe(before[1][0]);
    expect(cells()[4][0]).toBe("X");
  });
});
