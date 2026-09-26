// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/i18n/messages";

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const STORE = read("src/store/sheetStore.ts");
const ANNOUNCER = read("src/features/a11y/LiveAnnouncer.tsx");
const APP = read("src/app/app/page.tsx");
const KEYS = Object.keys(MESSAGES.th.live);

describe("the announcements the store can make", () => {
  it("has a message in both languages for every key", () => {
    expect(Object.keys(MESSAGES.en.live).sort()).toEqual(KEYS.sort());
  });

  it("gives the two languages the same arity, so neither drops an argument", () => {
    for (const key of KEYS) {
      const th = MESSAGES.th.live[key as keyof typeof MESSAGES.th.live];
      const en = MESSAGES.en.live[key as keyof typeof MESSAGES.en.live];
      expect(typeof th, `th.live.${key}`).toBe(typeof en);
      if (typeof th === "function" && typeof en === "function") {
        expect(en.length, `live.${key} takes ${th.length} arguments in Thai and ${en.length} in English`).toBe(th.length);
      }
    }
  });

  /**
   * The failure this is really for. A message nobody sends is a message that reads as covered and
   * is not — and the whole point of this feature is that silence was the bug. Reading the store's
   * source is enough to tell the two apart, and cheaper than driving every action in a browser.
   */
  it("actually sends every one of them from somewhere", () => {
    for (const key of KEYS) {
      expect(STORE.includes(`live.${key}`), `live.${key} is defined but never announced`).toBe(true);
    }
  });

  it("says nothing that has no message behind it", () => {
    for (const used of STORE.match(/live\.(\w+)/g) ?? []) {
      const key = used.slice("live.".length);
      expect(KEYS, `the store announces live.${key}, which no locale defines`).toContain(key);
    }
  });
});

describe("the region the announcements land in", () => {
  it("is mounted on the app page and never conditionally", () => {
    // A live region added at the same moment as its content is routinely missed: the screen reader
    // has to have been watching the node already.
    expect(APP).toContain("<LiveAnnouncer />");
    expect(APP.includes("&& <LiveAnnouncer")).toBe(false);
  });

  it("is polite rather than assertive", () => {
    expect(ANNOUNCER).toContain('aria-live="polite"');
    expect(ANNOUNCER).not.toContain('aria-live="assertive"');
  });

  it("keeps two regions, which is what makes a repeated message audible", () => {
    // Sorting the same column twice produces identical text; written to one node that is no change
    // at all, and a screen reader says nothing the second time.
    expect((ANNOUNCER.match(/aria-live="polite"/g) ?? []).length).toBe(2);
    expect(ANNOUNCER).toContain("seq");
  });

  it("is invisible", () => {
    expect((ANNOUNCER.match(/sr-only/g) ?? []).length).toBe(2);
  });
});

describe("what the messages read like", () => {
  it("names the column and the direction when sorting", () => {
    expect(MESSAGES.en.live.sorted("C", true)).toBe("Sorted column C ascending");
    expect(MESSAGES.en.live.sorted("C", false)).toBe("Sorted column C descending");
    expect(MESSAGES.th.live.sorted("C", true)).toContain("C");
  });

  it("says how much of the sheet a filter left behind", () => {
    expect(MESSAGES.en.live.filtered("B", 4, 9)).toBe("Filtered column B: 4 of 9 rows shown");
    expect(MESSAGES.th.live.filtered("B", 4, 9)).toContain("4");
  });

  it("gives a paste its shape and its landing place", () => {
    expect(MESSAGES.en.live.pasted(3, 2, "A1")).toBe("Pasted 3 rows by 2 columns at A1");
  });

  it("names the kind of chart and where it was drawn from", () => {
    expect(MESSAGES.en.live.chartAdded("Bar", "A1:C10")).toBe("Added a bar chart from A1:C10");
    expect(MESSAGES.th.live.chartAdded("แท่ง", "A1:C10")).toContain("A1:C10");
  });

  it("says how many charts are left, and reads right when none are", () => {
    // "0 left" is a sentence nobody says out loud; the zero case gets its own wording.
    expect(MESSAGES.en.live.chartRemoved(2)).toBe("Chart deleted, 2 left");
    expect(MESSAGES.en.live.chartRemoved(0)).toBe("Chart deleted, none left on this sheet");
    expect(MESSAGES.th.live.chartRemoved(0)).not.toContain("0");
  });

  it("gives a new pivot its name and its size, and says the app moved to it", () => {
    // Building a pivot switches the active sheet — the largest jump the app makes without the
    // user navigating, and the one most worth hearing about.
    expect(MESSAGES.en.live.pivotBuilt("Pivot 1", 12, 4)).toBe(
      "Built pivot sheet “Pivot 1”, 12 rows by 4 columns, and opened it"
    );
    expect(MESSAGES.th.live.pivotBuilt("สรุปข้อมูล 1", 12, 4)).toContain("12");
  });

  it("separates refreshing a pivot from building one", () => {
    expect(MESSAGES.en.live.pivotRefreshed(12, 4)).not.toContain("Built");
    expect(MESSAGES.en.live.pivotRefreshed(12, 4)).toContain("refreshed");
  });
});

describe("what is deliberately left silent", () => {
  /**
   * Each of these is a decision, not a gap, and each is here so that "it says nothing" cannot be
   * mistaken later for "nobody got round to it".
   */
  it("has no message for the pie-series picker, which is a native select", () => {
    // A `<select>` announces its own `<option>` when it changes; a live region on top of that is
    // the same double-talk that keeps cursor movement out of the announcer.
    expect(Object.keys(MESSAGES.th.live)).not.toContain("pieSeriesChanged");
    expect(STORE).toContain("Deliberately says nothing");
  });

  it("never announces from the live-data actions, which run on a timer", () => {
    // A region that announces itself every few seconds is not an accessibility feature, it is a
    // fault. Asserted against the action bodies rather than against key names, because a manual
    // pivot refresh *is* announced and a name-based rule cannot tell the two apart — the first
    // attempt at this test matched `pivotRefreshed` and failed on its own overreach.
    for (const action of ["applyLiveData", "addLiveBlock", "replaceLiveBlock"]) {
      // Eight spaces: the implementations sit at that indent, the interface declarations at two.
      // Matching the name alone finds the declaration first and runs on for ten thousand
      // characters, straight past the `say` helper — which is how the first version of this test
      // "caught" an announcement that was never there.
      const start = STORE.indexOf(`\n        ${action}: (`);
      expect(start, `${action} implementation not found — this extraction has gone stale`).toBeGreaterThan(-1);
      const rest = STORE.slice(start + 1);
      const nextAction = rest.search(/\n {8}(?:\/\*\*|\/\/ |[a-zA-Z]\w*: )/);
      const body = nextAction === -1 ? rest : rest.slice(0, nextAction);
      expect(body.length, `${action} body came out empty`).toBeGreaterThan(40);
      expect(body.includes("say("), `${action} announces, and it runs on a timer`).toBe(false);
    }
  });
});
