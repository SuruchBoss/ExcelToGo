// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { dragAxis, edgeStep } from "./dragRules";

describe("which way a grip drag is going", () => {
  it("decides nothing until the finger has moved a little", () => {
    expect(dragAxis(null, 3, 8)).toBe(null);
  });

  it("locks to rows when the drag is mostly vertical — a thumb drifting right while pulling down", () => {
    expect(dragAxis(null, 20, 60)).toBe("rows");
  });

  it("locks to columns when the drag is mostly sideways", () => {
    expect(dragAxis(null, 80, 10)).toBe("cols");
  });

  it("stays free on a real diagonal", () => {
    expect(dragAxis(null, 60, 70)).toBe(null);
  });

  it("keeps a rows lock through drift, and lets go past half a column sideways", () => {
    expect(dragAxis("rows", 50, 300)).toBe("rows");
    expect(dragAxis("rows", 57, 300)).toBe(null);
    expect(dragAxis("rows", -57, 300)).toBe(null);
  });

  it("keeps a columns lock through drift, and lets go the same way", () => {
    expect(dragAxis("cols", 300, 40)).toBe("cols");
    expect(dragAxis("cols", 300, 57)).toBe(null);
  });
});

describe("scrolling the sheet from its edge", () => {
  // A 390px-wide grid from x=8 to x=382; the right zone starts at 338.
  const low = 8;
  const high = 382;

  it("does not scroll from the zone the finger started in — the right-most column's grip", () => {
    expect(edgeStep(370, 365, low, high)).toBe(0);
  });

  it("scrolls once the finger has travelled toward that edge", () => {
    expect(edgeStep(370, 300, low, high)).toBeGreaterThan(0);
  });

  it("starts slow and speeds up with depth, never past the ceiling", () => {
    const shallow = edgeStep(340, 300, low, high);
    const deep = edgeStep(381, 300, low, high);
    expect(shallow).toBeGreaterThanOrEqual(2);
    expect(deep).toBeGreaterThan(shallow);
    expect(edgeStep(500, 300, low, high)).toBe(10);
  });

  it("scrolls back toward the near edge the same way", () => {
    expect(edgeStep(20, 100, low, high)).toBeLessThan(0);
    expect(edgeStep(20, 30, low, high)).toBe(0);
  });

  it("does nothing in the middle", () => {
    expect(edgeStep(200, 100, low, high)).toBe(0);
  });
});
