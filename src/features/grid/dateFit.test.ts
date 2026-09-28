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

/** A font as the page lays it out: digits 0.56em, separators 0.36em — unrounded, as a canvas says. */
const exact = (text: string) => (px: number) => [...text].reduce((w, ch) => w + (/\d/.test(ch) ? 0.56 : 0.36) * px, 0);
/** The same font hinted, as a headless Linux runner drew it: every glyph on a whole pixel. */
const hinted = (text: string) => (px: number) => [...text].reduce((w, ch) => w + Math.ceil((/\d/.test(ch) ? 0.56 : 0.36) * px), 0);

describe("how a date is drawn in its column", () => {
  it("as it is, when the grid's own font fits", () => {
    expect(dateScale(exact("28/09/2026"), 68, 112, 14)).toBe(1);
  });

  it("smaller, not ###, in the column width 9 a file gets by default (68px)", () => {
    const widthAt = exact("28/09/2026");
    const scale = dateScale(widthAt, excelTextWidth("28/09/2026"), 68, 14);
    expect(scale).not.toBeNull();
    expect(scale!).toBeLessThan(1);
    expect(Math.ceil(widthAt(14 * scale!))).toBeLessThanOrEqual(68 - 5);
    expect(dateScale(exact("2026-09-28"), excelTextWidth("2026-09-28"), 68, 14)).toBeLessThan(1);
  });

  it("fits what is drawn, not a proportion — a hinted font on CI drew it 1–3px over", () => {
    for (const text of ["28/09/2026", "2026-09-28"]) {
      const widthAt = hinted(text);
      // What scaling in proportion gives: over the room, the way CI's e2e found it.
      const proportional = (68 - 5) / widthAt(14);
      expect(widthAt(14 * proportional), text).toBeGreaterThan(68 - 5);
      const scale = dateScale(widthAt, excelTextWidth(text), 68, 14)!;
      expect(Math.ceil(widthAt(14 * scale)), text).toBeLessThanOrEqual(68 - 5);
    }
  });

  it("### in a column Excel cannot fit it in either", () => {
    expect(dateScale(exact("28/09/2026"), excelTextWidth("28/09/2026"), 30, 14)).toBeNull();
    expect(dateScale(exact("28/09/2026"), excelTextWidth("28/09/2026"), 67, 14)).toBeNull();
  });
});
