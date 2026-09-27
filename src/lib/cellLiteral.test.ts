// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { literalValue, looksNumeric, rawForText } from "./cellLiteral";
import { computeSheet, createEmptySheet, setCellRaw, setRangeFormat, SheetModel } from "./sheet";
import { computeStats, resetComputeCache } from "./sheetCompute";
import { sortRange } from "./sheetSort";
import { toCsv, trimGrid, valuesToCsvGrid } from "./csv";
import { exportWorkbookToXlsxBlob, importWorkbookFromFile } from "./excelIO";
import { fromStorage } from "./sheetCodec";

/** The three values the bug was reported with (#23): a phone number, an ID card, a code. */
const PHONE = "0812345678";
const ID_CARD = "1234567890123";
const CODE = "00123";

function sheetWith(column: string[], rows = 8, cols = 4): SheetModel {
  let sheet = createEmptySheet(rows, cols);
  column.forEach((raw, r) => (sheet = setCellRaw(sheet, r, 0, raw)));
  return sheet;
}

beforeEach(() => resetComputeCache());

describe("literalValue", () => {
  it("keeps a leading zero as text", () => {
    expect(literalValue(PHONE)).toBe(PHONE);
    expect(literalValue(CODE)).toBe(CODE);
    expect(literalValue("007")).toBe("007");
  });

  it("keeps twelve digits or more as text", () => {
    expect(literalValue(ID_CARD)).toBe(ID_CARD);
    expect(literalValue("123456789012")).toBe("123456789012");
  });

  it("still reads ordinary numbers as numbers", () => {
    expect(literalValue("0")).toBe(0);
    expect(literalValue("0.5")).toBe(0.5);
    expect(literalValue("-3")).toBe(-3);
    expect(literalValue("12.50")).toBe(12.5);
    // Eleven digits: the last length that is still an amount.
    expect(literalValue("10000000000")).toBe(10000000000);
    expect(literalValue("12345678901")).toBe(12345678901);
  });

  it("does not stretch the twelve-digit rule to numbers that carry a point or a sign", () => {
    expect(literalValue("123456789012.5")).toBe(123456789012.5);
    expect(literalValue("-123456789012")).toBe(-123456789012);
  });

  it("reads an apostrophe as 'the rest is text' and drops it from the value", () => {
    expect(literalValue("'123")).toBe("123");
    expect(literalValue(`'${PHONE}`)).toBe(PHONE);
    expect(literalValue("'hello")).toBe("hello");
    // Only the first one: Excel's `''x` shows `'x`.
    expect(literalValue("''x")).toBe("'x");
    expect(literalValue("'")).toBe("");
  });

  it("leaves blank and ordinary text alone", () => {
    expect(literalValue("")).toBeNull();
    expect(literalValue("   ")).toBe("   ");
    expect(literalValue("abc")).toBe("abc");
  });
});

describe("on the grid", () => {
  it("shows the three reported values exactly as typed", () => {
    const computed = computeSheet(sheetWith([PHONE, ID_CARD, CODE]));
    expect(computed.display[0][0]).toBe(PHONE);
    expect(computed.display[1][0]).toBe(ID_CARD);
    expect(computed.display[2][0]).toBe(CODE);
    expect(computed.values[0][0]).toBe(PHONE);
  });

  it("hides the apostrophe on the grid while the cell itself keeps it for the formula bar", () => {
    const sheet = sheetWith([`'${PHONE}`, "'123"]);
    const computed = computeSheet(sheet);
    expect(computed.display[0][0]).toBe(PHONE);
    expect(computed.display[1][0]).toBe("123");
    expect(computed.values[1][0]).toBe("123");
    expect(sheet.cells[0][0]).toBe(`'${PHONE}`);
  });

  it("picks the change up incrementally, not only on a full pass", () => {
    let sheet = sheetWith(["5"]);
    sheet = setCellRaw(sheet, 0, 1, "=LEN(A1)");
    expect(computeSheet(sheet).values[0][1]).toBe(1);
    sheet = setCellRaw(sheet, 0, 0, PHONE);
    expect(computeSheet(sheet).values[0][1]).toBe(10);
    sheet = setCellRaw(sheet, 0, 0, "'5");
    expect(computeSheet(sheet).values[0][0]).toBe("5");
  });
});

describe("formulas reading a phone number stored as text", () => {
  function evalWith(formula: string, column = [PHONE]) {
    const sheet = setCellRaw(sheetWith(column), 0, 1, formula);
    return computeSheet(sheet).values[0][1];
  }

  it("=A1+1 still does arithmetic on it, as Excel does", () => {
    expect(evalWith("=A1+1")).toBe(812345679);
  });

  it("=LEN(A1) counts the zero", () => {
    expect(evalWith("=LEN(A1)")).toBe(10);
  });

  it('=A1&"" keeps the zero', () => {
    expect(evalWith('=A1&""')).toBe(PHONE);
  });

  it("=SUM(A1:A3) is left as it was before #23", () => {
    // Pinned, not endorsed. Excel's answer is 0 — SUM skips text in a range — and this engine
    // adds numeric-looking text up. Changing that changes what existing sheets total to, so it is
    // its own issue: #38. When #38 lands this expectation is the one that should move.
    expect(evalWith("=SUM(A1:A3)", [PHONE, CODE, "1"])).toBe(812345678 + 123 + 1);
  });
});

describe("everything downstream of the computed values", () => {
  it("sorts a leading-zero code as text, after the numbers", () => {
    // Read as the number 7 it would land between 3 and 9, which is where it used to go.
    const sheet = sheetWith(["9", "007", "3"]);
    const sorted = sortRange(sheet, computeSheet(sheet), { startRow: 0, endRow: 2, startCol: 0, endCol: 0 }, 0, true);
    expect(sorted.cells.slice(0, 3).map((row) => row[0])).toEqual(["3", "9", "007"]);
  });

  it("writes the values to CSV exactly as typed", () => {
    const sheet = sheetWith([PHONE, ID_CARD, CODE, `'${PHONE}`]);
    const csv = toCsv(trimGrid(valuesToCsvGrid(computeSheet(sheet).values)), { bom: false });
    expect(csv.split("\r\n")).toEqual([PHONE, ID_CARD, CODE, PHONE]);
  });

  it("writes them to .xlsx as string cells, not numbers", async () => {
    const sheet = sheetWith([PHONE, ID_CARD, CODE, `'${PHONE}`, "42"]);
    const blob = await exportWorkbookToXlsxBlob([{ name: "S", sheet, computed: computeSheet(sheet) }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.worksheets[0];
    expect(ws.getCell("A1").value).toBe(PHONE);
    expect(ws.getCell("A2").value).toBe(ID_CARD);
    expect(ws.getCell("A3").value).toBe(CODE);
    expect(ws.getCell("A4").value).toBe(PHONE);
    expect(ws.getCell("A5").value).toBe(42);
  });
});

describe("a sheet saved before #23", () => {
  it("loads from storage unchanged and shows its zeros again, with no migration", () => {
    // Written out by hand as it sits in localStorage today: nothing in it knew about the fix.
    const saved = JSON.parse(`{"rows":4,"cols":2,"cells":{"0,0":"${PHONE}","1,0":"${ID_CARD}","2,0":"${CODE}","3,0":"42"}}`);
    const sheet = fromStorage(saved);
    expect(sheet.cells[0][0]).toBe(PHONE);
    const computed = computeSheet(sheet);
    expect([0, 1, 2, 3].map((r) => computed.display[r][0])).toEqual([PHONE, ID_CARD, CODE, "42"]);
    expect(computed.values[3][0]).toBe(42);
  });
});

describe("rawForText", () => {
  it("leaves text alone when the rules already keep it text", () => {
    for (const t of [PHONE, ID_CARD, CODE, "hello", "", "="]) expect(rawForText(t)).toBe(t);
  });

  it("marks text that would otherwise be read as something else", () => {
    expect(rawForText("123")).toBe("'123");
    expect(rawForText("-3")).toBe("'-3");
    expect(rawForText("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(rawForText("'quoted")).toBe("''quoted");
  });

  it("always reads back as the same text", () => {
    for (const t of [PHONE, ID_CARD, CODE, "123", "0", "1e3", "=A1", "'x", "  7 ", "hello"]) {
      expect(literalValue(rawForText(t))).toBe(t);
    }
  });

  it("knows what a spreadsheet would read as a number", () => {
    expect(looksNumeric("123")).toBe(true);
    expect(looksNumeric(PHONE)).toBe(true);
    expect(looksNumeric("12a")).toBe(false);
    expect(looksNumeric(" ")).toBe(false);
  });
});

describe("the .xlsx round trip", () => {
  async function exported(column: string[]): Promise<ExcelJS.Worksheet> {
    const sheet = sheetWith(column);
    const blob = await exportWorkbookToXlsxBlob([{ name: "S", sheet, computed: computeSheet(sheet) }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    return wb.worksheets[0];
  }

  async function roundTrip(column: string[]): Promise<SheetModel> {
    const sheet = sheetWith(column);
    const blob = await exportWorkbookToXlsxBlob([{ name: "S", sheet, computed: computeSheet(sheet) }]);
    const [{ sheet: back }] = await importWorkbookFromFile(new File([await blob.arrayBuffer()], "t.xlsx"));
    return back;
  }

  it("marks number-looking text as text (@) so Excel does not turn it back into a number", async () => {
    const ws = await exported([PHONE, ID_CARD, CODE, "'123", "42", "hello"]);
    for (const addr of ["A1", "A2", "A3", "A4"]) {
      expect(typeof ws.getCell(addr).value).toBe("string");
      expect(ws.getCell(addr).numFmt).toBe("@");
    }
    expect(ws.getCell("A5").numFmt).not.toBe("@");
    // Ordinary text needs no marker: nothing would read it as a number.
    expect(ws.getCell("A6").numFmt).not.toBe("@");
  });

  it("brings the three reported values back exactly as typed", async () => {
    const back = await roundTrip([PHONE, ID_CARD, CODE]);
    const computed = computeSheet(back);
    expect([0, 1, 2].map((r) => computed.display[r][0])).toEqual([PHONE, ID_CARD, CODE]);
    expect([0, 1, 2].map((r) => computed.values[r][0])).toEqual([PHONE, ID_CARD, CODE]);
  });

  it("keeps apostrophe text as text, and numbers as numbers", async () => {
    const back = await roundTrip(["'123", "42"]);
    expect(back.cells[0][0]).toBe("'123");
    const computed = computeSheet(back);
    expect(computed.values[0][0]).toBe("123");
    expect(computed.values[1][0]).toBe(42);
  });

  it("reads a string cell from Excel as text, even when it is digits or starts with =", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("S");
    ws.getCell("A1").value = "123";
    ws.getCell("A2").value = "=1+1";
    ws.getCell("A3").value = 123;
    ws.getCell("A4").value = { formula: "1+1", result: 2 };
    const [{ sheet }] = await importWorkbookFromFile(new File([await wb.xlsx.writeBuffer()], "x.xlsx"));
    expect(sheet.cells[0][0]).toBe("'123");
    expect(sheet.cells[1][0]).toBe("'=1+1");
    expect(sheet.cells[2][0]).toBe("123");
    expect(sheet.cells[3][0]).toBe("=1+1");
    const computed = computeSheet(sheet);
    expect(computed.values[0][0]).toBe("123");
    expect(computed.values[1][0]).toBe("=1+1");
    expect(computed.values[3][0]).toBe(2);
  });
});

describe('the "text" number format', () => {
  const asText = (sheet: SheetModel) => setRangeFormat(sheet, 0, 0, 0, 0, { numberFormat: "text" });
  const asGeneral = (sheet: SheetModel) => setRangeFormat(sheet, 0, 0, 0, 0, { numberFormat: "general" });

  it("keeps whatever is typed as text", () => {
    expect(literalValue("123", "text")).toBe("123");
    expect(literalValue("-3", "text")).toBe("-3");
    // The apostrophe is still the marker, and is still hidden.
    expect(literalValue("'123", "text")).toBe("123");
    expect(literalValue("", "text")).toBeNull();
    const computed = computeSheet(asText(sheetWith(["123"])));
    expect(computed.values[0][0]).toBe("123");
    expect(computed.display[0][0]).toBe("123");
  });

  it("changes the value the moment the format changes, in both directions, without a full recompute", () => {
    let sheet = setCellRaw(sheetWith(["123"]), 0, 1, "=A1");
    expect(computeSheet(sheet).values[0][1]).toBe(123);

    sheet = asText(sheet);
    const before = computeStats.incremental;
    const text = computeSheet(sheet);
    expect(computeStats.incremental).toBe(before + 1);
    expect(text.values[0][0]).toBe("123");
    // And a formula reading the cell hears about it, which a display-only restyle would not do.
    expect(text.values[0][1]).toBe("123");

    sheet = asGeneral(sheet);
    const back = computeSheet(sheet);
    expect(computeStats.incremental).toBe(before + 2);
    expect(back.values[0][0]).toBe(123);
    expect(back.values[0][1]).toBe(123);
  });

  it("still only re-renders when the format moves between number formats", () => {
    let sheet = setCellRaw(sheetWith(["0.5"]), 0, 1, "=A1");
    computeSheet(sheet);
    sheet = setRangeFormat(sheet, 0, 0, 0, 0, { numberFormat: "percent" });
    const computed = computeSheet(sheet);
    expect(computed.values[0][0]).toBe(0.5);
    expect(computed.display[0][0]).toBe("0.50%");
  });

  it("goes out to .xlsx as a string cell formatted @, and comes back formatted as text", async () => {
    const sheet = asText(sheetWith(["123"]));
    const blob = await exportWorkbookToXlsxBlob([{ name: "S", sheet, computed: computeSheet(sheet) }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    expect(wb.worksheets[0].getCell("A1").value).toBe("123");
    expect(wb.worksheets[0].getCell("A1").numFmt).toBe("@");

    const [{ sheet: back }] = await importWorkbookFromFile(new File([await blob.arrayBuffer()], "t.xlsx"));
    expect(back.formats[0][0]?.numberFormat).toBe("text");
    expect(computeSheet(back).values[0][0]).toBe("123");
  });

  it("reads a column Excel formatted as text, with numbers typed into it, as text", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("S");
    ws.getCell("A1").value = "00123";
    ws.getCell("A1").numFmt = "@";
    const [{ sheet }] = await importWorkbookFromFile(new File([await wb.xlsx.writeBuffer()], "x.xlsx"));
    expect(sheet.formats[0][0]?.numberFormat).toBe("text");
    expect(computeSheet(sheet).display[0][0]).toBe("00123");
  });
});
