import { describe, expect, it } from "vitest";
import { rowOffsets, rowWindow, scrollToShowRow } from "./rowWindow";

const H = 32;
const flat = (rows: number, hidden?: Set<number>) => rowOffsets(rows, () => H, hidden);

describe("row offsets", () => {
  it("measures each row and the bottom of the last one", () => {
    const offsets = flat(3);
    expect(offsets).toEqual([0, 32, 64, 96]);
  });

  it("gives a hidden row no height at all", () => {
    // Row 1 filtered out: row 2 moves up into its place rather than leaving a gap.
    expect(flat(4, new Set([1]))).toEqual([0, 32, 32, 64, 96]);
  });

  it("follows per-row heights from an imported file", () => {
    expect(rowOffsets(3, (r) => (r === 1 ? 80 : H))).toEqual([0, 32, 112, 144]);
  });
});

describe("row window", () => {
  const win = (scrollTop: number, viewportHeight: number, rows = 1000, overscan = 0) =>
    rowWindow({ rows, offsets: flat(rows), scrollTop, viewportHeight, overscan });

  it("renders only what the viewport covers", () => {
    const w = win(0, 320);
    expect(w.start).toBe(0);
    expect(w.end).toBe(10);
    expect(w.topPad).toBe(0);
  });

  it("pads above and below so the scrollbar still measures the whole sheet", () => {
    const w = win(3200, 320);
    expect(w.topPad).toBe(3200);
    expect(w.topPad + (w.end - w.start + 1) * H + w.bottomPad).toBe(1000 * H);
  });

  it("keeps the last row reachable", () => {
    const w = win(1000 * H - 320, 320);
    expect(w.end).toBe(999);
    expect(w.bottomPad).toBe(0);
  });

  it("renders a band beyond each edge so a flick does not show blank rows", () => {
    const tight = win(3200, 320, 1000, 0);
    const loose = win(3200, 320, 1000, 320);
    expect(loose.start).toBeLessThan(tight.start);
    expect(loose.end).toBeGreaterThan(tight.end);
  });

  it("renders everything before the first measurement rather than one row", () => {
    // A zero-height viewport is what the first render sees, and a window of one row there would
    // flash an empty grid until the first scroll event arrived.
    const w = win(0, 0, 40);
    expect(w.start).toBe(0);
    expect(w.end).toBe(39);
  });

  it("reaches back for a merge whose anchor is above the window", () => {
    const rows = 1000;
    const merged = { startRow: 90, startCol: 0, endRow: 110, endCol: 2 };
    const plain = rowWindow({ rows, offsets: flat(rows), scrollTop: 3200, viewportHeight: 320, overscan: 0 });
    const withMerge = rowWindow({
      rows,
      offsets: flat(rows),
      scrollTop: 3200,
      viewportHeight: 320,
      overscan: 0,
      merges: [merged],
    });
    expect(plain.start).toBe(100);
    // The rowSpan lives on row 90; without it the covered rows render as nothing at all.
    expect(withMerge.start).toBe(90);
    expect(withMerge.topPad).toBe(90 * H);
  });

  it("ignores a merge that ends above the window", () => {
    const rows = 1000;
    const w = rowWindow({
      rows,
      offsets: flat(rows),
      scrollTop: 3200,
      viewportHeight: 320,
      overscan: 0,
      merges: [{ startRow: 10, startCol: 0, endRow: 20, endCol: 1 }],
    });
    expect(w.start).toBe(100);
  });

  it("handles an empty sheet", () => {
    const w = rowWindow({ rows: 0, offsets: [0], scrollTop: 0, viewportHeight: 300, overscan: 0 });
    expect(w).toEqual({ start: 0, end: -1, topPad: 0, bottomPad: 0 });
  });
});

describe("scrolling a row into view", () => {
  const offsets = flat(1000);

  it("does nothing when the row is already on screen", () => {
    expect(scrollToShowRow(offsets, 5, 0, 600, H)).toBeNull();
  });

  it("scrolls up far enough to clear the sticky column header", () => {
    // Row 100 starts at 3200. Stopping the scroll there would leave it under the header.
    expect(scrollToShowRow(offsets, 100, 4000, 600, H)).toBe(3200 - H);
  });

  it("scrolls down just enough to show the whole row", () => {
    expect(scrollToShowRow(offsets, 100, 0, 600, H)).toBe(3232 - 600);
  });

  it("returns null for a row that is not there", () => {
    expect(scrollToShowRow(offsets, 1000, 0, 600, H)).toBeNull();
    expect(scrollToShowRow(offsets, -1, 0, 600, H)).toBeNull();
  });
});
