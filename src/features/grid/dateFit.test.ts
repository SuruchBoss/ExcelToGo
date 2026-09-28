// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { dateScale, excelTextWidth } from "./dateFit";

/**
 * A date shows wherever Excel would show it, however much wider the grid's font is (#136), and
 * `###` is kept for a column Excel cannot fit it in either (#45).
 */
describe("the width Excel gives a date", () => {
  it("counts Calibri 11: digits 7, a slash 6, a dash 4", () => {
    expect(excelTextWidth("28/09/2026")).toBe(68);
    expect(excelTextWidth("2026-09-28")).toBe(64);
    expect(excelTextWidth("14:30")).toBe(32);
  });

  it("grows with the cell's font size", () => {
    expect(excelTextWidth("2026-09-28", 22)).toBe(128);
  });
});

describe("how a date is drawn in its column", () => {
  it("as it is, when the grid's own font fits", () => {
    expect(dateScale(70, 68, 112)).toBe(1);
  });

  it("smaller, not ###, in the column width 9 a file gets by default (68px)", () => {
    const scale = dateScale(78, excelTextWidth("28/09/2026"), 68);
    expect(scale).not.toBeNull();
    expect(scale!).toBeLessThan(1);
    expect(78 * scale!).toBeLessThanOrEqual(68 - 5);
    expect(dateScale(76, excelTextWidth("2026-09-28"), 68)).toBeLessThan(1);
  });

  it("### in a column Excel cannot fit it in either", () => {
    expect(dateScale(78, excelTextWidth("28/09/2026"), 30)).toBeNull();
    expect(dateScale(78, excelTextWidth("28/09/2026"), 67)).toBeNull();
  });
});
