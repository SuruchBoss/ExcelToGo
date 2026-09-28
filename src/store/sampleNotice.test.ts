// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { singleCellSelection } from "@/types/sheet-ui";
import { toStorage } from "@/lib/sheetCodec";
import { isStoredSample, selectHasWork, selectShowingSample, useSheetStore } from "./sheetStore";

/**
 * The app opens blank, and the sample is one press away (the owner's call: a grid already full of
 * sample prices read as data left behind). The rule the sample's notice depends on is unchanged: it
 * shows while — and only while — the workbook is exactly the sample as it was opened. Left showing,
 * it calls someone's own work "sample data"; retired too early, a visitor sees unexplained data.
 */
const fresh = useSheetStore.getState();
const state = () => useSheetStore.getState();
const undo = () => useSheetStore.temporal.getState().undo();

beforeEach(() => {
  useSheetStore.setState({ sheets: fresh.sheets, activeSheetId: fresh.activeSheetId });
  useSheetStore.temporal.getState().clear();
  state().openSample();
});

describe("opening the app", () => {
  it("opens on one empty sheet, which is not work and not the sample", () => {
    useSheetStore.setState({ sheets: fresh.sheets, activeSheetId: fresh.activeSheetId });
    expect(state().sheets).toHaveLength(1);
    expect(state().sheets[0].sheet.cells.flat().filter(Boolean)).toHaveLength(0);
    expect(selectShowingSample(state())).toBe(false);
    expect(selectHasWork(state())).toBe(false);
  });

  it("opens the sample on request, and undo takes it away again", () => {
    useSheetStore.setState({ sheets: fresh.sheets, activeSheetId: fresh.activeSheetId });
    useSheetStore.temporal.getState().clear();
    state().openSample();
    expect(selectShowingSample(state())).toBe(true);
    undo();
    expect(state().sheets[0].sheet.cells.flat().filter(Boolean)).toHaveLength(0);
  });
});

describe("a sample left in a browser by the version that opened on it", () => {
  const stored = () => state().sheets.map((tab) => ({ ...tab, sheet: toStorage(tab.sheet) }));

  it("is recognised as the sample, in either language, and so is not restored", () => {
    expect(isStoredSample(stored())).toBe(true);
    state().showSampleIn("en");
    expect(isStoredSample(stored())).toBe(true);
  });

  it("is somebody's work after any change at all", () => {
    state().setCellRaw(1, 2, "100");
    expect(isStoredSample(stored())).toBe(false);
    state().openSample();
    state().addRow();
    expect(isStoredSample(stored())).toBe(false);
    state().openSample();
    state().addSheet();
    expect(isStoredSample(stored())).toBe(false);
  });
});

describe("New file", () => {
  it("replaces work with one empty sheet, and undo brings the work back", () => {
    state().setCellRaw(1, 2, "100");
    expect(selectHasWork(state())).toBe(true);
    useSheetStore.temporal.getState().clear();
    state().startBlank();
    expect(state().sheets[0].sheet.cells.flat().filter(Boolean)).toHaveLength(0);
    undo();
    expect(state().sheets[0].sheet.cells[1][2]).toBe("100");
  });

  it("says out loud what it did, and how to take it back", () => {
    state().startBlank();
    expect(state().announcement?.text).toMatch(/ย้อนกลับ|undo/i);
  });
});

describe("while nothing has been touched", () => {
  it("reports the sample as showing", () => {
    expect(selectShowingSample(useSheetStore.getState())).toBe(true);
  });

  it("the sample actually holds data worth pressing Pivot on", () => {
    // The banner tells people to try it; an empty sheet would make that a lie.
    const sheet = useSheetStore.getState().sheets[0].sheet;
    const filled = sheet.cells.flat().filter(Boolean).length;
    expect(filled).toBeGreaterThan(40);
  });
});

describe("as soon as anything changes", () => {
  it("retires once a cell is typed into", () => {
    useSheetStore.getState().setCellRaw(1, 2, "100");
    expect(selectShowingSample(useSheetStore.getState())).toBe(false);
  });

  it("retires on a change that leaves every cell's content alone", () => {
    // Identity, not content: formatting and charts leave the cells as they were, and treating the
    // workbook as untouched afterwards would let "start blank" throw away real work.
    useSheetStore.getState().addRow();
    expect(selectShowingSample(useSheetStore.getState())).toBe(false);
  });

  it("retires once a second sheet exists", () => {
    useSheetStore.getState().addSheet();
    expect(selectShowingSample(useSheetStore.getState())).toBe(false);
  });
});

describe("starting from a blank sheet", () => {
  it("leaves one empty sheet and no sample content", () => {
    useSheetStore.getState().startBlank();
    const s = useSheetStore.getState();
    expect(s.sheets).toHaveLength(1);
    expect(s.sheets[0].sheet.cells.flat().filter(Boolean)).toHaveLength(0);
  });

  it("retires the banner, so it cannot offer to clear an already-blank sheet", () => {
    useSheetStore.getState().startBlank();
    expect(selectShowingSample(useSheetStore.getState())).toBe(false);
  });

  it("does not carry the old sheet's selection onto the new one", () => {
    // The new tab gets a new id, so `selectionBySheetId` has no entry for it and the default
    // applies. Asserted rather than assumed: a stale selection pointing past the end of a smaller
    // sheet is the classic way this kind of "replace everything" action goes wrong.
    useSheetStore.getState().setSelection(singleCellSelection(8, 4));
    const before = useSheetStore.getState().activeSheetId;
    useSheetStore.getState().startBlank();
    const s = useSheetStore.getState();
    expect(s.activeSheetId).not.toBe(before);
    expect(s.selectionBySheetId[s.activeSheetId]).toBeUndefined();
  });
});

describe("in the language on screen", () => {
  const cellsOf = () => useSheetStore.getState().sheets[0].sheet.cells;

  it("switches to the English sample, and still counts as the sample", () => {
    useSheetStore.getState().showSampleIn("en");
    expect(cellsOf()[0].slice(0, 5)).toEqual(["Product", "Category", "Price", "Qty", "Total"]);
    expect(selectShowingSample(useSheetStore.getState())).toBe(true);
  });

  it("keeps every number and formula, so both languages total the same", () => {
    const th = cellsOf().map((row) => row.slice(2));
    useSheetStore.getState().showSampleIn("en");
    const en = cellsOf().map((row) => row.slice(2));
    // Column C onwards, minus the two cells that are words: the headers and the total's label.
    const numeric = (grid: string[][]) => grid.slice(1).map((row) => row.filter((v) => !v || /^[=\d]/.test(v)));
    expect(numeric(en)).toEqual(numeric(th));
  });

  it("switches back, and stays out of the undo history", () => {
    useSheetStore.temporal.getState().clear();
    useSheetStore.getState().showSampleIn("en");
    useSheetStore.getState().showSampleIn("th");
    expect(cellsOf()[0][0]).toBe("สินค้า");
    expect(useSheetStore.temporal.getState().pastStates).toHaveLength(0);
  });

  it("never touches a workbook somebody has changed", () => {
    // The whole reason the swap is safe: the sample belongs to nobody. One typed cell and it is
    // theirs, in whatever language they were reading when they typed it.
    useSheetStore.getState().setCellRaw(1, 2, "100");
    const before = useSheetStore.getState().sheets;
    useSheetStore.getState().showSampleIn("en");
    expect(useSheetStore.getState().sheets).toBe(before);
    expect(cellsOf()[0][0]).toBe("สินค้า");
  });

  it("does not bring the sample back after starting blank", () => {
    useSheetStore.getState().startBlank();
    useSheetStore.getState().showSampleIn("en");
    expect(cellsOf().flat().filter(Boolean)).toHaveLength(0);
  });
});
