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
});
