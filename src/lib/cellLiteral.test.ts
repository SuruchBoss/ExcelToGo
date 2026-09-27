// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { literalValue } from "./cellLiteral";
import { computeSheet, createEmptySheet, setCellRaw, SheetModel } from "./sheet";
import { resetComputeCache } from "./sheetCompute";
import { sortRange } from "./sheetSort";
import { toCsv, trimGrid, valuesToCsvGrid } from "./csv";
import { exportWorkbookToXlsxBlob } from "./excelIO";
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
