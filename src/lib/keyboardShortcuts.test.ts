// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GLOBAL_SHORTCUT_KEYS, SHORTCUT_GROUPS, formatKey, isAppleKeyboard } from "./keyboardShortcuts";

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const GRID = "src/features/grid/SpreadsheetGrid.tsx";
const STORE = "src/store/sheetStore.ts";

const allShortcuts = SHORTCUT_GROUPS.flatMap((g) => g.shortcuts);
const documented = new Set(allShortcuts.flatMap((s) => s.handles));

/**
 * The `case "X":` labels of the grid's key handler.
 *
 * Reading the source rather than the behaviour because the alternative is rendering the grid and
 * pressing every key, which tests the test harness more than the app. What matters here is only
 * that the two lists agree — whether each key does the right thing is `gridNavigation.test.ts`.
 */
function gridCases(): string[] {
  const src = read(GRID);
  const handler = src.slice(src.indexOf("const handleKeyDown"), src.indexOf("const isInSelection"));
  expect(handler, "could not find handleKeyDown — this test's extraction has gone stale").not.toBe("");
  return [...new Set((handler.match(/case "([^"]+)":/g) ?? []).map((m) => m.slice(6, -2)))];
}

describe("the shortcut list against the grid's key handler", () => {
  it("documents every key the grid handles", () => {
    for (const key of gridCases()) {
      expect(documented.has(key), `the grid handles "${key}" and no shortcut row mentions it`).toBe(true);
    }
  });

  it("claims no key the grid does not handle", () => {
    const handled = new Set(gridCases());
    for (const key of documented) {
      expect(handled.has(key), `a shortcut row claims "${key}", which the grid does not handle`).toBe(true);
    }
  });

  it("finds enough cases to be worth trusting", () => {
    // If the slice above ever stops matching, it returns nothing and both tests pass vacuously.
    expect(gridCases().length).toBeGreaterThan(10);
  });
});

describe("the shortcut list against the store's global handlers", () => {
  it("documents undo, redo, copy, cut and paste", () => {
    const combos = allShortcuts.flatMap((s) => s.combos.map((c) => c.join("+")));
    for (const combo of ["Mod+Z", "Mod+Y", "Mod+Shift+Z", "Mod+C", "Mod+X", "Mod+V"]) {
      expect(combos, `${combo} is missing from the list`).toContain(combo);
    }
  });

  it("claims no global letter the store does not compare against", () => {
    // The other direction — a row for a key nothing listens to — is what `GLOBAL_SHORTCUT_KEYS`
    // is for: it names the letters the store's handlers branch on, and this checks they are real.
    const src = read(STORE);
    for (const key of GLOBAL_SHORTCUT_KEYS) {
      expect(src, `the store never compares a key against "${key}"`).toContain(`key !== "${key}"`);
    }
  });

  it("knows the paste path is an event, not a key comparison", () => {
    // Ctrl+V is documented but appears in no key handler: pasting is the browser's own `paste`
    // event, which right-click and the Edit menu fire too. Worth asserting so nobody "fixes" the
    // list by deleting the row that looks unsupported.
    expect(read(STORE)).toContain('addEventListener("paste"');
  });
});

describe("drawing a key", () => {
  it("shows ⌘ on a Mac and Ctrl everywhere else", () => {
    expect(formatKey("Mod", true)).toBe("⌘");
    expect(formatKey("Mod", false)).toBe("Ctrl");
  });

  it("draws arrows as arrows", () => {
    expect(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].map((k) => formatKey(k, false))).toEqual(["↑", "↓", "←", "→"]);
  });

  it("draws the four of them as one key", () => {
    // Rendered as four separate combos, "move one cell" reads like a chord you have to press all
    // of at once. As one key it reads the way a printed shortcut card would write it.
    expect(formatKey("Arrows", false)).toBe("↑↓←→");
  });

  it("passes anything it has no opinion about straight through", () => {
    expect(formatKey("F2", false)).toBe("F2");
    expect(formatKey("Home", true)).toBe("Home");
  });

  it("recognises an Apple keyboard from either the platform or the user agent", () => {
    expect(isAppleKeyboard("MacIntel")).toBe(true);
    expect(isAppleKeyboard("iPhone")).toBe(true);
    expect(isAppleKeyboard("", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(true);
    expect(isAppleKeyboard("Win32", "Mozilla/5.0 (Windows NT 10.0)")).toBe(false);
    expect(isAppleKeyboard("Linux x86_64")).toBe(false);
  });
});

describe("the list itself", () => {
  it("gives every row at least one way to press it", () => {
    for (const s of allShortcuts) {
      expect(s.combos.length, `${s.id} has no key combination`).toBeGreaterThan(0);
      for (const combo of s.combos) expect(combo.length, `${s.id} has an empty combination`).toBeGreaterThan(0);
    }
  });

  it("uses each id once, so a description cannot be shown twice", () => {
    const ids = allShortcuts.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
