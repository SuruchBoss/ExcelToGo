// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv, quoteCsvField, stripBom, toCsv, trimGrid } from "./csv";

describe("stripBom", () => {
  it("removes a UTF-8 BOM so it doesn't become part of the first heading", () => {
    expect(stripBom("﻿สินค้า,ราคา")).toBe("สินค้า,ราคา");
  });

  it("leaves text without one alone", () => {
    expect(stripBom("สินค้า")).toBe("สินค้า");
  });
});

describe("detectDelimiter", () => {
  it("finds the comma in an ordinary file", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
  });

  it("finds the semicolon Excel writes in a Thai or European locale", () => {
    expect(detectDelimiter("สินค้า;ราคา;จำนวน\nกาแฟ;45;12")).toBe(";");
  });

  it("finds a tab", () => {
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  /** The reason the counting has to know about quotes at all. */
  it("ignores delimiters inside quoted fields", () => {
    const text = 'name;address\nสมชาย;"Bangkok, Thailand, 10110"\nสมหญิง;"Chiang Mai, Thailand"';
    expect(detectDelimiter(text)).toBe(";");
  });

  it("falls back to a comma when there is nothing to count", () => {
    expect(detectDelimiter("onecolumn\nvalue")).toBe(",");
  });
});

describe("parseCsv", () => {
  it("parses a plain file", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps a quoted delimiter inside its field", () => {
    expect(parseCsv('a,"x,y",c')).toEqual([["a", "x,y", "c"]]);
  });

  it("unescapes a doubled quote", () => {
    expect(parseCsv('a,"say ""hi""",c')).toEqual([["a", 'say "hi"', "c"]]);
  });

  it("keeps a newline inside a quoted field", () => {
    expect(parseCsv('a,"line1\nline2",c')).toEqual([["a", "line1\nline2", "c"]]);
  });

  it("accepts CRLF, LF and a lone CR", () => {
    expect(parseCsv("a,b\r\n1,2\n3,4\r5,6")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
  });

  it("does not invent a trailing row for a file that ends in a newline", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps a row of empty fields, which is not the same as no row", () => {
    expect(parseCsv("a,b\n,\n1,2")).toEqual([
      ["a", "b"],
      ["", ""],
      ["1", "2"],
    ]);
  });

  it("pads short rows so the result is a rectangle", () => {
    expect(parseCsv("a,b,c\n1,2")).toEqual([
      ["a", "b", "c"],
      ["1", "2", ""],
    ]);
  });

  it("reads Thai with a semicolon delimiter", () => {
    expect(parseCsv("สินค้า;ราคา\nกาแฟ;45")).toEqual([
      ["สินค้า", "ราคา"],
      ["กาแฟ", "45"],
    ]);
  });

  it("strips the BOM before parsing", () => {
    expect(parseCsv("﻿a,b\n1,2")[0][0]).toBe("a");
  });
});

describe("quoteCsvField", () => {
  it("leaves an ordinary value bare", () => {
    expect(quoteCsvField("กาแฟ", ",")).toBe("กาแฟ");
  });

  it("quotes a value holding the delimiter", () => {
    expect(quoteCsvField("x,y", ",")).toBe('"x,y"');
  });

  it("does not quote a comma when the delimiter is a semicolon", () => {
    expect(quoteCsvField("x,y", ";")).toBe("x,y");
  });

  it("doubles inner quotes", () => {
    expect(quoteCsvField('say "hi"', ",")).toBe('"say ""hi"""');
  });

  it("quotes a value with a newline in it", () => {
    expect(quoteCsvField("line1\nline2", ",")).toBe('"line1\nline2"');
  });

  it("quotes surrounding spaces, which would otherwise be free to vanish", () => {
    expect(quoteCsvField("  padded  ", ",")).toBe('"  padded  "');
  });
});

describe("toCsv", () => {
  it("writes CRLF and a BOM, which is what Excel wants", () => {
    expect(toCsv([["a", "b"], ["1", "2"]])).toBe("﻿a,b\r\n1,2");
  });

  it("can leave the BOM out for anything that isn't Excel", () => {
    expect(toCsv([["a"]], { bom: false })).toBe("a");
  });

  it("honours a chosen delimiter", () => {
    expect(toCsv([["a", "b"]], { delimiter: ";", bom: false })).toBe("a;b");
  });

  /** The property that matters more than any single case: anything written can be read back. */
  it("round-trips the values that need quoting", () => {
    const rows = [
      ["สินค้า", "หมายเหตุ", "ราคา"],
      ["กาแฟ", 'ใส่ "นม" ด้วย', "45"],
      ["ขนมปัง", "Bangkok, Thailand", "30"],
      ["นม", "line1\nline2", "25"],
      ["", "  padded  ", ""],
    ];
    for (const delimiter of [",", ";", "\t"] as const) {
      expect(parseCsv(toCsv(rows, { delimiter }), delimiter)).toEqual(rows);
    }
  });
});

describe("trimGrid", () => {
  it("drops the empty rows and columns a fresh sheet is mostly made of", () => {
    const grid = [
      ["a", "b", "", ""],
      ["1", "2", "", ""],
      ["", "", "", ""],
    ];
    expect(trimGrid(grid)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps an empty cell that has content to the right of it", () => {
    expect(trimGrid([["", "b"], ["", ""]])).toEqual([["", "b"]]);
  });

  it("gives nothing back for a sheet with nothing in it", () => {
    expect(trimGrid([["", ""], ["", ""]])).toEqual([]);
  });
});
