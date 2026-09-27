// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { formulaBarCellKey, formulaBarShown, formulaBarWrite } from "./formulaBarDraft";

/**
 * The formula bar's two questions — what to show, and what leaving it writes — as the store sees
 * them (#42). The browser half, a real focus and blur, is an e2e flow.
 */
const A1 = formulaBarCellKey("s1", 0, 0);

describe("the formula bar never writes what nobody typed (#42)", () => {
  it("shows the cell as it is now, whatever it was when the bar was first shown", () => {
    // A sort, a Delete or an undo changes the cell under the same address. With no draft, the bar
    // follows it.
    expect(formulaBarShown(null, A1, "85")).toBe("85");
    expect(formulaBarShown(null, A1, "")).toBe("");
  });

  it("writes nothing when the bar was focused and left without typing", () => {
    expect(formulaBarWrite(null, A1, "85")).toBeNull();
  });

  it("writes what was typed, for the cell it was typed for", () => {
    const draft = { cellKey: A1, text: "=SUM(B1:B3)" };
    expect(formulaBarShown(draft, A1, "old")).toBe("=SUM(B1:B3)");
    expect(formulaBarWrite(draft, A1, "old")).toBe("=SUM(B1:B3)");
  });

  it("writes nothing when what was typed is what the cell already holds", () => {
    expect(formulaBarWrite({ cellKey: A1, text: "same" }, A1, "same")).toBeNull();
  });

  it("does not carry a draft to another cell, or to the same address on another sheet", () => {
    const draft = { cellKey: A1, text: "typed for A1" };
    const B1 = formulaBarCellKey("s1", 0, 1);
    const otherSheetA1 = formulaBarCellKey("s2", 0, 0);
    expect(formulaBarShown(draft, B1, "b1")).toBe("b1");
    expect(formulaBarWrite(draft, B1, "b1")).toBeNull();
    expect(formulaBarWrite(draft, otherSheetA1, "")).toBeNull();
  });

  it("keeps Thai text exactly as typed", () => {
    const draft = { cellKey: A1, text: "ยอดขายเดือนนี้" };
    expect(formulaBarWrite(draft, A1, "")).toBe("ยอดขายเดือนนี้");
  });
});
