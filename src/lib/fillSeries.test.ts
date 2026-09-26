// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { fillTargetFor, fillValues } from "./fillSeries";

const fill = (seed: string[], count: number, rowOffset = seed.length, colOffset = 0) =>
  fillValues({ seed, count, rowOffset, colOffset });

describe("numbers", () => {
  it("continues a single number by one", () => {
    expect(fill(["1"], 3)).toEqual(["2", "3", "4"]);
  });

  it("follows the gap two cells set", () => {
    expect(fill(["5", "10"], 3)).toEqual(["15", "20", "25"]);
  });

  it("counts downwards", () => {
    expect(fill(["10", "8"], 3)).toEqual(["6", "4", "2"]);
  });

  it("repeats rather than guessing when the gap is not constant", () => {
    // Excel fits a trend line to 1, 4, 9. A wrong guess in a spreadsheet is a number nobody
    // questions, so an unrecognised run is repeated instead of extrapolated.
    expect(fill(["1", "4", "9"], 3)).toEqual(["1", "4", "9"]);
  });

  it("does not leave float noise behind", () => {
    // 0.1 + 0.1 + 0.1 is 0.30000000000000004 in binary, and that is not a number to show anyone.
    expect(fill(["0.1", "0.2"], 2)).toEqual(["0.3", "0.4"]);
  });

  it("reads a number written with thousands separators", () => {
    expect(fill(["1,000", "2,000"], 2)).toEqual(["3000", "4000"]);
  });
});

describe("lists with names", () => {
  it("continues Thai weekday abbreviations", () => {
    expect(fill(["จ", "อ"], 3)).toEqual(["พ", "พฤ", "ศ"]);
  });

  it("continues Thai months and wraps at the end of the year", () => {
    expect(fill(["พ.ย.", "ธ.ค."], 2)).toEqual(["ม.ค.", "ก.พ."]);
  });

  it("continues English weekdays whatever the capitalisation", () => {
    expect(fill(["mon", "TUE"], 2)).toEqual(["Wed", "Thu"]);
  });

  it("continues quarters and wraps", () => {
    expect(fill(["Q3"], 3)).toEqual(["Q4", "Q1", "Q2"]);
  });

  it("follows a gap inside a named list", () => {
    expect(fill(["Jan", "Mar"], 2)).toEqual(["May", "Jul"]);
  });
});

describe("text with a number on the end", () => {
  it("continues the number and keeps the words", () => {
    expect(fill(["รอบที่ 1", "รอบที่ 2"], 2)).toEqual(["รอบที่ 3", "รอบที่ 4"]);
  });

  it("keeps zero padding", () => {
    expect(fill(["Item 08"], 2)).toEqual(["Item 09", "Item 10"]);
  });

  it("refuses when the words differ, and repeats instead", () => {
    expect(fill(["Item 1", "Thing 2"], 2)).toEqual(["Item 1", "Thing 2"]);
  });
});

describe("formulas", () => {
  it("moves the references down, it does not extend them as a series", () => {
    expect(fill(["=A1*2"], 3, 1, 0)).toEqual(["=A2*2", "=A3*2", "=A4*2"]);
  });

  it("leaves an absolute reference where it is", () => {
    expect(fill(["=$A$1*2"], 2, 1, 0)).toEqual(["=$A$1*2", "=$A$1*2"]);
  });

  it("moves sideways when the drag is sideways", () => {
    expect(fill(["=A1"], 2, 0, 1)).toEqual(["=B1", "=C1"]);
  });

  it("keeps a cross-sheet reference pointing at the same sheet", () => {
    expect(fill(["=Sheet2!A1"], 2, 1, 0)).toEqual(["=Sheet2!A2", "=Sheet2!A3"]);
  });

  it("steps a two-formula seed a whole block at a time", () => {
    // Seeding with B1 and B2 and dragging down continues B3, B4 — not B2, B3.
    expect(fill(["=A1", "=A2"], 4, 2, 0)).toEqual(["=A3", "=A4", "=A5", "=A6"]);
  });
});

describe("everything else", () => {
  it("repeats plain text", () => {
    expect(fill(["กาแฟ"], 3)).toEqual(["กาแฟ", "กาแฟ", "กาแฟ"]);
  });

  it("cycles a repeated seed rather than only using its first cell", () => {
    expect(fill(["a", "b"], 5)).toEqual(["a", "b", "a", "b", "a"]);
  });

  it("does not read a run containing a blank as a number series", () => {
    expect(fill(["1", "", "3"], 2)).toEqual(["1", ""]);
  });

  it("answers nothing for an empty request", () => {
    expect(fill([], 3)).toEqual([]);
    expect(fill(["1"], 0)).toEqual([]);
  });
});

describe("which block a drag fills", () => {
  const source = { startRow: 1, startCol: 1, endRow: 2, endCol: 2 };

  it("fills downwards", () => {
    expect(fillTargetFor(source, 5, 2)).toEqual({ startRow: 3, endRow: 5, startCol: 1, endCol: 2 });
  });

  it("fills upwards", () => {
    expect(fillTargetFor(source, 0, 2)).toEqual({ startRow: 0, endRow: 0, startCol: 1, endCol: 2 });
  });

  it("fills to the right", () => {
    expect(fillTargetFor(source, 2, 5)).toEqual({ startCol: 3, endCol: 5, startRow: 1, endRow: 2 });
  });

  it("fills to the left", () => {
    expect(fillTargetFor(source, 2, 0)).toEqual({ startCol: 0, endCol: 0, startRow: 1, endRow: 2 });
  });

  it("picks one axis when the drag wandered diagonally", () => {
    // Four rows down and one column across is a downward fill. Filling both would overwrite a
    // rectangle nobody asked for.
    expect(fillTargetFor(source, 6, 3)).toEqual({ startRow: 3, endRow: 6, startCol: 1, endCol: 2 });
  });

  it("fills nothing when the drag stays inside the selection", () => {
    expect(fillTargetFor(source, 2, 2)).toBeNull();
    expect(fillTargetFor(source, 1, 1)).toBeNull();
  });
});
