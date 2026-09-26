// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { createEmptySheet } from "./sheet";
import { clampFreeze, isFrozen, NO_FREEZE, shiftFreeze, toggleFreezeAt, withFreeze } from "./sheetFreeze";

const sheet = () => createEmptySheet(30, 10);

describe("freezing from where the cursor is", () => {
  it("freezes everything above and to the left, the way Excel does", () => {
    // Standing on B3 freezes two rows and one column.
    expect(toggleFreezeAt(sheet(), 2, 1).freeze).toEqual({ rows: 2, cols: 1 });
  });

  it("freezes only rows when the cursor is in the first column", () => {
    expect(toggleFreezeAt(sheet(), 1, 0).freeze).toEqual({ rows: 1, cols: 0 });
  });

  it("unfreezes on the second press, so one button is both halves", () => {
    // A button that only ever adds is one people press once and then go looking for the other.
    const frozen = toggleFreezeAt(sheet(), 2, 1);
    expect(toggleFreezeAt(frozen, 5, 5).freeze).toBeUndefined();
  });

  it("does nothing at A1, because there is nothing above or left of it", () => {
    expect(toggleFreezeAt(sheet(), 0, 0).freeze).toBeUndefined();
  });
});

describe("what a split is allowed to be", () => {
  it("refuses to freeze the whole sheet", () => {
    // Not a smaller version of freezing three rows — a sheet that cannot scroll looks like a bug.
    expect(clampFreeze(createEmptySheet(5, 4), { rows: 5, cols: 4 })).toEqual({ rows: 4, cols: 3 });
  });

  it("refuses a negative or fractional split", () => {
    expect(clampFreeze(sheet(), { rows: -3, cols: 2.7 })).toEqual({ rows: 0, cols: 2 });
  });

  it("drops the field entirely rather than storing a split of nothing", () => {
    const frozen = withFreeze(sheet(), { rows: 2, cols: 0 });
    expect(withFreeze(frozen, NO_FREEZE)).not.toHaveProperty("freeze");
  });

  it("hands back the same object when nothing changes, so nothing downstream recomputes", () => {
    // Sheet identity is what the compute cache and the React memos key on.
    const frozen = withFreeze(sheet(), { rows: 2, cols: 1 });
    expect(withFreeze(frozen, { rows: 2, cols: 1 })).toBe(frozen);
    const plain = sheet();
    expect(withFreeze(plain, NO_FREEZE)).toBe(plain);
  });

  it("knows the difference between no split and a split of zero", () => {
    expect(isFrozen(undefined)).toBe(false);
    expect(isFrozen({ rows: 0, cols: 0 })).toBe(false);
    expect(isFrozen({ rows: 0, cols: 2 })).toBe(true);
  });
});

describe("the split follows the rows it was drawn between", () => {
  const frozen = withFreeze(createEmptySheet(30, 10), { rows: 3, cols: 2 });

  it("moves down when a row is inserted above it", () => {
    // The header row that has had a row inserted above it is still the header row.
    expect(shiftFreeze(frozen, "row", 0, 1).freeze).toEqual({ rows: 4, cols: 2 });
  });

  it("moves up when a row above it is deleted", () => {
    expect(shiftFreeze(frozen, "row", 1, -1).freeze).toEqual({ rows: 2, cols: 2 });
  });

  it("stays put for a change at or below the split", () => {
    expect(shiftFreeze(frozen, "row", 3, 1).freeze).toEqual({ rows: 3, cols: 2 });
    expect(shiftFreeze(frozen, "row", 20, -1).freeze).toEqual({ rows: 3, cols: 2 });
  });

  it("does the same for columns, and only for the axis that moved", () => {
    expect(shiftFreeze(frozen, "col", 0, 1).freeze).toEqual({ rows: 3, cols: 3 });
    expect(shiftFreeze(frozen, "col", 5, -1).freeze).toEqual({ rows: 3, cols: 2 });
  });

  it("lets a split be deleted down to nothing", () => {
    let sheet = withFreeze(createEmptySheet(30, 10), { rows: 1, cols: 0 });
    sheet = shiftFreeze(sheet, "row", 0, -1);
    expect(sheet.freeze).toBeUndefined();
  });

  it("leaves an unfrozen sheet alone", () => {
    const plain = createEmptySheet(30, 10);
    expect(shiftFreeze(plain, "row", 0, 1)).toBe(plain);
  });
});
