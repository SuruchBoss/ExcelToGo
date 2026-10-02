// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { computeTab, undoSheet, useSheetStore } from "./sheetStore";

/**
 * A name made in the app is the workbook's (#60).
 *
 * It was the sheet's: `PriceTable` made on Products was `#REF!` from Orders, and the export wrote
 * it as workbook-level anyway, so the file and the app disagreed about the same name. Through the
 * store, because what matters is the whole path — the name box, the tab it lands on, the formula on
 * another tab and the undo that takes it back.
 */
const state = () => useSheetStore.getState();
const tab = (i: number) => state().sheets[i];
const select = (r1: number, c1: number, r2 = r1, c2 = c1) =>
  state().setSelection({ startRow: r1, startCol: c1, endRow: r2, endCol: c2, anchorRow: r1, anchorCol: c1 });

beforeEach(() => {
  state().startBlank();
  useSheetStore.temporal.getState().clear();
  // Products: code and price. Orders comes second and looks one up.
  [["P1", "100"], ["P2", "250"]].forEach(([code, price], r) => {
    state().setCellRaw(r, 0, code);
    state().setCellRaw(r, 1, price);
  });
  state().renameSheet(tab(0).id, "Products");
  select(0, 0, 1, 1);
  expect(state().defineName("PriceTable")).toBeNull();
  state().addSheet();
  state().renameSheet(tab(1).id, "Orders");
});

describe("a name made in the app works from every sheet (#60)", () => {
  it("PriceTable made on Products answers a VLOOKUP on Orders", () => {
    state().setCellRaw(0, 0, '=VLOOKUP("P2",PriceTable,2,FALSE)');
    expect(computeTab(tab(1).sheet, state().sheets).values[0][0]).toBe(250);
    // Stored where it was made, workbook-level, its target bare on that sheet.
    expect(tab(0).sheet.names?.PRICETABLE).toEqual({ label: "PriceTable", ref: "$A$1:$B$2" });
  });

  it("the same word cannot be taken twice from another sheet, and a new one lands on the sheet in front", () => {
    select(0, 0);
    expect(state().defineName("pricetable")).toBe("taken");
    expect(state().defineName("Qty")).toBeNull();
    expect(tab(1).sheet.names?.QTY?.ref).toBe("$A$1");
  });

  it("a name deleted from Orders is deleted where it lives, and undo brings it back", () => {
    state().setCellRaw(0, 0, "=SUM(PriceTable)");
    state().deleteName("PriceTable");
    expect(tab(0).sheet.names).toBeUndefined();
    expect(computeTab(tab(1).sheet, state().sheets).values[0][0]).toMatchObject({ code: "#NAME?" });
    undoSheet();
    expect(computeTab(tab(1).sheet, state().sheets).values[0][0]).toBe(350);
  });

  it("pointing it at a new range from Orders keeps it one name, now on Orders", () => {
    state().setCellRaw(0, 0, "7");
    state().setCellRaw(0, 1, "=SUM(PriceTable)");
    select(0, 0);
    expect(state().defineName("PriceTable", "PriceTable")).toBeNull();
    expect(tab(0).sheet.names).toBeUndefined();
    expect(computeTab(tab(1).sheet, state().sheets).values[0][1]).toBe(7);
  });
});
