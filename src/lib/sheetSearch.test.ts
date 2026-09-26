// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { createEmptySheet, setCellRaw } from "./sheet";
import {
  DEFAULT_SEARCH_OPTIONS,
  findMatches,
  matchLabel,
  nextMatchFrom,
  replaceIn,
  type SearchableSheet,
} from "./sheetSearch";

const opts = (over: Partial<typeof DEFAULT_SEARCH_OPTIONS> = {}) => ({ ...DEFAULT_SEARCH_OPTIONS, ...over });

function sheetOf(cells: Record<string, string>) {
  let s = createEmptySheet();
  for (const [ref, raw] of Object.entries(cells)) {
    s = setCellRaw(s, Number(ref.slice(1)) - 1, ref.charCodeAt(0) - 65, raw);
  }
  return s;
}
const book = (...tabs: { name: string; cells: Record<string, string> }[]): SearchableSheet[] =>
  tabs.map((t, i) => ({ id: `s${i}`, name: t.name, sheet: sheetOf(t.cells) }));

describe("finding", () => {
  const sheets = book({ name: "Sheet1", cells: { A1: "กาแฟ", B2: "ชาไทย", C3: "กาแฟเย็น" } });

  it("finds every cell containing the text", () => {
    expect(findMatches(sheets, "กาแฟ", opts()).map(matchLabel)).toEqual(["Sheet1!A1", "Sheet1!C3"]);
  });

  it("ignores case by default and respects it when asked", () => {
    const s = book({ name: "S", cells: { A1: "Coffee", A2: "coffee" } });
    expect(findMatches(s, "COFFEE", opts()).length).toBe(2);
    expect(findMatches(s, "COFFEE", opts({ matchCase: true })).length).toBe(0);
    expect(findMatches(s, "coffee", opts({ matchCase: true })).map(matchLabel)).toEqual(["S!A2"]);
  });

  it("can require the whole cell rather than a substring", () => {
    expect(findMatches(sheets, "กาแฟ", opts({ wholeCell: true })).map(matchLabel)).toEqual(["Sheet1!A1"]);
  });

  it("finds nothing for an empty search, rather than everything", () => {
    expect(findMatches(sheets, "", opts())).toEqual([]);
  });

  it("returns matches in reading order across sheets", () => {
    // Find Next has to walk the sheet the way an eye would; a list that reorders itself around the
    // cursor makes the tenth press a surprise.
    const two = book(
      { name: "One", cells: { B2: "x", A1: "x" } },
      { name: "Two", cells: { A5: "x" } }
    );
    expect(findMatches(two, "x", opts()).map(matchLabel)).toEqual(["One!A1", "One!B2", "Two!A5"]);
  });

  it("searches the raw text, so a formula is found by what was typed", () => {
    const s = book({ name: "S", cells: { A1: "=SUM(B1:B9)" } });
    expect(findMatches(s, "SUM", opts()).map(matchLabel)).toEqual(["S!A1"]);
  });
});

describe("walking through the matches", () => {
  const matches = findMatches(
    book({ name: "S", cells: { A1: "x", C1: "x", B3: "x" } }),
    "x",
    opts()
  );

  it("starts at the first match when nothing is selected", () => {
    expect(nextMatchFrom(matches, null, 1)).toBe(0);
    expect(nextMatchFrom(matches, null, -1)).toBe(matches.length - 1);
  });

  it("goes to the next one after the cursor", () => {
    expect(matchLabel(matches[nextMatchFrom(matches, { sheetId: "s0", row: 0, col: 0 }, 1)])).toBe("S!C1");
  });

  it("wraps round the end", () => {
    expect(nextMatchFrom(matches, { sheetId: "s0", row: 2, col: 1 }, 1)).toBe(0);
  });

  it("goes backwards, and wraps the other way", () => {
    expect(matchLabel(matches[nextMatchFrom(matches, { sheetId: "s0", row: 2, col: 1 }, -1)])).toBe("S!C1");
    expect(nextMatchFrom(matches, { sheetId: "s0", row: 0, col: 0 }, -1)).toBe(matches.length - 1);
  });

  it("answers -1 when there is nothing to walk", () => {
    expect(nextMatchFrom([], null, 1)).toBe(-1);
  });
});

describe("replacing", () => {
  it("replaces every occurrence in a cell", () => {
    expect(replaceIn("a-b-a", "a", "z", opts())).toBe("z-b-z");
  });

  it("replaces case-insensitively while keeping what is around it", () => {
    expect(replaceIn("Coffee and COFFEE", "coffee", "ชา", opts())).toBe("ชา and ชา");
  });

  it("replaces only exact case when asked", () => {
    expect(replaceIn("Coffee and COFFEE", "COFFEE", "ชา", opts({ matchCase: true }))).toBe("Coffee and ชา");
  });

  it("swaps the whole cell in whole-cell mode", () => {
    expect(replaceIn("กาแฟเย็น", "กาแฟเย็น", "ชา", opts({ wholeCell: true }))).toBe("ชา");
    expect(replaceIn("กาแฟเย็น", "กาแฟ", "ชา", opts({ wholeCell: true }))).toBe("กาแฟเย็น");
  });

  it("leaves a cell that does not match exactly as it was", () => {
    expect(replaceIn("ชาไทย", "กาแฟ", "x", opts())).toBe("ชาไทย");
  });

  it("does not treat the search text as a regular expression", () => {
    // A search box that evaluates expressions is a search box one escape away from a bug; the
    // replace walks the string by hand for that reason.
    expect(replaceIn("a.b.c", ".", "-", opts())).toBe("a-b-c");
    expect(replaceIn("price (net)", "(net)", "[net]", opts())).toBe("price [net]");
    expect(replaceIn("100% sure", "%", " percent", opts())).toBe("100 percent sure");
  });

  it("terminates when the replacement contains the search text", () => {
    // Naive repeated replacement loops for ever here.
    expect(replaceIn("cat", "cat", "cats", opts())).toBe("cats");
    expect(replaceIn("aa", "a", "aa", opts())).toBe("aaaa");
  });

  it("does nothing for an empty search", () => {
    expect(replaceIn("anything", "", "x", opts())).toBe("anything");
  });
});
