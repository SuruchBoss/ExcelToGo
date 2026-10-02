// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { afterAll, describe, expect, it } from "vitest";
import { computeSheet, createEmptySheet } from "../sheet";
import { serialOf } from "../excelDate";
import type { FormulaValue } from "./types";

/**
 * A date function reads only what the rest of the app reads as a date (#169).
 *
 * `1/9/2026` typed the Thai way — 1 September — stays text in the cell, on purpose: day-first and
 * month-first cannot be told apart, and #45/#82 leave it to "Convert to dates". But DAY, MONTH, YEAR
 * and DATEDIF went another way, through `new Date(text)`: US order and local midnight, so DAY gave
 * 8 in Bangkok and 9 in New York, with nothing on screen to say the date was not one.
 *
 * Every case runs in both zones, switched in-process, so a result that leans on the machine's clock
 * shows up as two different answers.
 */
const ZONES = ["Asia/Bangkok", "America/New_York"];
const originalTz = process.env.TZ;
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

/** The value a formula in F1 gives over the cells, with errors as their code. */
function valueOf(formula: string, cells: Record<string, string | number> = {}): FormulaValue | string {
  const sheet = createEmptySheet();
  for (const [ref, raw] of Object.entries({ ...cells, F1: formula })) {
    const cell = sheet.cells[Number(ref.slice(1)) - 1];
    cell[ref.charCodeAt(0) - 65] = typeof raw === "number" ? String(raw) : raw;
  }
  const v = computeSheet(sheet).values[0][5];
  return v !== null && typeof v === "object" ? (v as { code: string }).code : v;
}

describe.each(ZONES)("date functions in %s (#169)", (zone) => {
  const inZone = () => {
    process.env.TZ = zone;
  };

  it("a Gregorian d/m/yyyy text is not a date: DAY, MONTH, YEAR are #VALUE!, as +1 already was", () => {
    inZone();
    const cells = { A1: "1/9/2026" };
    expect(valueOf("=DAY(A1)", cells)).toBe("#VALUE!");
    expect(valueOf("=MONTH(A1)", cells)).toBe("#VALUE!");
    expect(valueOf("=YEAR(A1)", cells)).toBe("#VALUE!");
    expect(valueOf("=A1+1", cells)).toBe("#VALUE!");
  });

  it("written into the formula it is the same #VALUE!", () => {
    inZone();
    expect(valueOf('=DAY("1/9/2026")')).toBe("#VALUE!");
    expect(valueOf('=MONTH("1/9/2026")')).toBe("#VALUE!");
    expect(valueOf('=DAY("15/9/2026")')).toBe("#VALUE!");
  });

  it("DATEDIF with such a text at either end is #VALUE! too", () => {
    inZone();
    expect(valueOf('=DATEDIF(A1,"2026-12-31","D")', { A1: "1/9/2026" })).toBe("#VALUE!");
    expect(valueOf('=DATEDIF("2026-01-01",A1,"D")', { A1: "1/9/2026" })).toBe("#VALUE!");
  });

  it("dates the app does read still come out the same: B.E., ISO and a serial from a file", () => {
    inZone();
    expect(valueOf("=DAY(A1)", { A1: "3/9/2569" })).toBe(3);
    expect(valueOf("=MONTH(A1)", { A1: "3/9/2569" })).toBe(9);
    expect(valueOf("=YEAR(A1)", { A1: "3/9/2569" })).toBe(2026);
    expect(valueOf("=DAY(A1)", { A1: "2026-09-01" })).toBe(1);
    expect(valueOf("=MONTH(A1)", { A1: "2026-09-01" })).toBe(9);
    expect(valueOf("=DAY(A1)", { A1: serialOf(2026, 9, 1) })).toBe(1);
    expect(valueOf('=DAY("2026-09-01")')).toBe(1);
    expect(valueOf('=DATEDIF("2026-01-01",A1,"D")', { A1: "2026-09-01" })).toBe(243);
  });
});
