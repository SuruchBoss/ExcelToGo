// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { LESSONS, computeLesson, lessonBySlug, lessonForId, lessonFormula, lessonSheet } from "./lessons";
import { getFormulaById } from "./formulaCatalog";
import { parseCellRef } from "./formulaEngine/address";
import { th } from "@/i18n/th";

/**
 * The formula pages (#149) show no number anyone typed: every result comes from the engine at render.
 * These pin what the engine gives for each example, so a change to the engine or to a lesson that
 * moves a number on a page turns something red here first — and check that each "common mistake"
 * really gives a different answer, because one that does not teaches nothing.
 */
const EXPECTED: Record<string, string> = {
  sum: "6000",
  sumif: "450",
  countif: "3",
  if: "ผ่าน",
  vlookup: "35",
};

describe("the formula lessons (#149)", () => {
  it("each teaches a formula the palette has, and its example uses that formula", () => {
    for (const l of LESSONS) {
      expect(getFormulaById(th, l.id), l.slug).toBeDefined();
      expect(lessonFormula(l).toUpperCase(), l.slug).toContain(`${l.id}(`);
    }
  });

  it("each example works out, in the engine, to the value pinned here", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(LESSONS.map((l) => l.slug).sort());
    for (const l of LESSONS) {
      const { result, isError } = computeLesson(l);
      expect({ slug: l.slug, result, isError }).toEqual({ slug: l.slug, result: EXPECTED[l.slug], isError: false });
    }
  });

  it("every mistake gives a different answer from the example, or it would teach nothing", () => {
    for (const l of LESSONS) {
      expect(l.mistakes.length, l.slug).toBeGreaterThan(0);
      for (const m of l.mistakes) {
        expect(m.formula || m.cells, `${l.slug}: ${m.title}`).toBeTruthy();
        expect(computeLesson(l, m).result, `${l.slug}: ${m.title}`).not.toBe(computeLesson(l).result);
      }
    }
  });

  it("the mistakes are the ones the pages describe: a wrong total, a miss, a wrong row", () => {
    const wrong = (slug: string, i: number) => computeLesson(lessonBySlug(slug)!, lessonBySlug(slug)!.mistakes[i]).result;
    expect(wrong("sum", 1)).toBe("4570"); // "1430 บาท" is text, and SUM skips it
    expect(wrong("sumif", 0)).toBe("620"); // SUM adds every branch
    expect(wrong("countif", 0)).toBe("2"); // a trailing space is not a match
    expect(wrong("if", 0)).toBe("ไม่ผ่าน"); // > leaves out exactly 50
    expect(wrong("if", 1)).toBe("#NAME?");
    expect(wrong("vlookup", 0)).toBe("8"); // approximate match on an unsorted table: another row's price
    expect(wrong("vlookup", 1)).toBe("สมุด");
  });

  it("addresses are lower case and unique, one page per formula", () => {
    const slugs = LESSONS.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const l of LESSONS) expect(l.slug).toBe(l.id.toLowerCase());
    expect(lessonBySlug("SUMIF")).toBeUndefined();
    expect(lessonForId("SUMIF")?.slug).toBe("sumif");
  });

  it("the page's argument list lines up with the palette's syntax", () => {
    for (const l of LESSONS) {
      const def = getFormulaById(th, l.id)!;
      const inside = def.syntax.slice(def.syntax.indexOf("(") + 1, def.syntax.lastIndexOf(")"));
      expect(inside.split(",").length, l.slug).toBe(def.params.length);
    }
  });

  it("the result cell and the shaded rows are inside the table, and related formulas exist", () => {
    for (const l of LESSONS) {
      const at = parseCellRef(l.example.result);
      expect(at && l.example.grid[at.row]?.[at.col]?.startsWith("="), l.slug).toBe(true);
      for (const r of l.example.picked ?? []) expect(r >= 2 && r <= l.example.grid.length, `${l.slug} row ${r}`).toBe(true);
      for (const id of l.related) expect(getFormulaById(th, id), `${l.slug} → ${id}`).toBeDefined();
    }
  });

  it("the sheet the app opens holds exactly the page's table", () => {
    const l = lessonBySlug("sumif")!;
    const sheet = lessonSheet(l);
    l.example.grid.forEach((row, r) => row.forEach((raw, c) => expect(sheet.cells[r][c]).toBe(raw)));
    expect(sheet.cells[l.example.grid.length].every((v) => v === "")).toBe(true);
  });
});
