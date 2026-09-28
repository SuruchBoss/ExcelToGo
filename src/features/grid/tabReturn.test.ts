// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { afterEnter, afterTab, type TabRun } from "./tabReturn";

describe("Tab then Enter", () => {
  it("returns to the column the Tabs started from, one row down", () => {
    let run: TabRun | null = null;
    run = afterTab(run, 4, 1, 2); // B5 → C5
    run = afterTab(run, 4, 2, 3); // C5 → D5
    expect(afterEnter(run, 4, 3, false, 100)).toEqual({ row: 5, col: 1 });
  });

  it("goes straight down when there was no run", () => {
    expect(afterEnter(null, 4, 3, false, 100)).toEqual({ row: 5, col: 3 });
  });

  it("forgets the run once the cursor has been moved some other way", () => {
    const run = afterTab(null, 4, 1, 2);
    // The cursor is now somewhere the run never reached — a click or an arrow put it there.
    expect(afterEnter(run, 7, 6, false, 100)).toEqual({ row: 8, col: 6 });
    expect(afterEnter(run, 4, 5, false, 100)).toEqual({ row: 5, col: 5 });
  });

  it("a Tab from somewhere new starts a new run instead of extending the old one", () => {
    const old = afterTab(null, 4, 1, 2);
    const fresh = afterTab(old, 9, 5, 6);
    expect(fresh).toEqual({ row: 9, startCol: 5, lastCol: 6 });
  });

  it("Shift+Enter goes up to the start column, and neither direction leaves the sheet", () => {
    const run = afterTab(null, 0, 2, 3);
    expect(afterEnter(run, 0, 3, true, 100)).toEqual({ row: 0, col: 2 });
    const bottom = afterTab(null, 99, 0, 1);
    expect(afterEnter(bottom, 99, 1, false, 100)).toEqual({ row: 99, col: 0 });
  });
});
