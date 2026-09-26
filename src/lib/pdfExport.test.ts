// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { readFileSync } from "fs";
import { fixThaiMarks } from "./pdfExport";

/** A jsPDF document with the real Thai font registered, as the export builds it. */
function thaiDoc() {
  const doc = new jsPDF();
  const base64 = readFileSync("public/fonts/NotoSansThai-Regular.ttf").toString("base64");
  doc.addFileToVFS("NotoSansThai-Regular.ttf", base64);
  doc.addFont("NotoSansThai-Regular.ttf", "NotoSansThai", "normal");
  doc.setFont("NotoSansThai", "normal");
  return doc;
}

/** Records every string the document is asked to draw, and where. */
function recordDraws(doc: jsPDF) {
  const draws: { text: unknown; x: number; y: number }[] = [];
  const inner = doc.text.bind(doc);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test spy over jsPDF's overloads
  (doc as any).text = (text: any, x: number, y: number, ...rest: any[]) => {
    draws.push({ text, x, y });
    return inner(text, x, y, ...rest);
  };
  return draws;
}

describe("fixThaiMarks", () => {
  it("draws the colliding tone mark a second time, higher up", () => {
    const doc = thaiDoc();
    const draws = recordDraws(doc);
    fixThaiMarks(doc);
    doc.text("ที่", 20, 50);

    // The word without its tone mark, then the tone mark on its own above the baseline.
    expect(draws.map((d) => d.text)).toEqual(["ที", "่"]);
    expect(draws[1].y).toBeLessThan(draws[0].y);
    // ...and at the x where the mark's own syllable sits, not at the start of the line.
    expect(draws[1].x).toBeCloseTo(20 + doc.getTextWidth("ที"), 5);
  });

  it("leaves text with nothing to move completely alone", () => {
    for (const word of ["ป่า", "ผู้", "ดี", "Total 123"]) {
      const doc = thaiDoc();
      const draws = recordDraws(doc);
      fixThaiMarks(doc);
      doc.text(word, 20, 50);
      expect(draws.map((d) => d.text), word).toEqual([word]);
    }
  });

  // Regression: autoTable hands each cell over as a string ARRAY, one entry per wrapped line.
  // The first version of this only looked at plain strings, so it silently did nothing for every
  // cell in the table — the exported PDF was unchanged and the bug looked unfixed.
  it("handles the string array autoTable actually passes", () => {
    const doc = thaiDoc();
    const draws = recordDraws(doc);
    fixThaiMarks(doc);
    doc.text(["ที่"], 20, 50);

    expect(draws[0].text).toEqual(["ที"]);
    expect(draws.slice(1).map((d) => d.text)).toEqual(["่"]);
  });

  it("offsets a lifted mark onto its own line in multi-line text", () => {
    const doc = thaiDoc();
    const draws = recordDraws(doc);
    fixThaiMarks(doc);
    doc.text(["ดี", "ที่"], 20, 50);

    const mark = draws.find((d) => d.text === "่");
    expect(mark).toBeDefined();
    // The mark belongs to the second line, so it sits below the first line's baseline.
    expect(mark!.y).toBeGreaterThan(50);
  });

  it("survives a real autoTable render with Thai cells", () => {
    const doc = thaiDoc();
    // Spy first, patch second: the patch captures whatever `text` is at the time it runs, so this
    // order is what lets the spy observe the individual draws the patch makes.
    const draws = recordDraws(doc);
    fixThaiMarks(doc);
    autoTable(doc, {
      head: [["A"]],
      body: [["ที่"], ["ดื่ม"], ["ป่า"]],
      styles: { font: "NotoSansThai", fontSize: 8 },
    });
    const drawn = draws.map((d) => JSON.stringify(d.text));
    // Each colliding cell contributes its stripped word plus a separately drawn mark.
    expect(drawn).toContain(JSON.stringify(["ที"]));
    expect(drawn).toContain(JSON.stringify(["ดืม"]));
    expect(drawn).toContain(JSON.stringify(["ป่า"])); // untouched
    expect(drawn.filter((d) => d === JSON.stringify("่"))).toHaveLength(2);
  });
});
