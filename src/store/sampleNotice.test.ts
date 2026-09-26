// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { singleCellSelection } from "@/types/sheet-ui";
import { selectShowingSample, useSheetStore } from "./sheetStore";

/**
 * The rule the sample banner depends on: it is shown while — and only while — the workbook is
 * still exactly what the app opened with. Getting this wrong in either direction is a real cost:
 * left showing, it calls someone's own work "sample data"; retired too early, the first thing a
 * visitor sees is unexplained data in a grid, which is what prompted the banner in the first place.
 */
const fresh = useSheetStore.getState();

beforeEach(() => {
  useSheetStore.setState({ sheets: fresh.sheets, activeSheetId: fresh.activeSheetId });
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
