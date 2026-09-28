// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { chartDataFrom } from "./charts";
import { dateTextReader, valuesWithIsoDates } from "./dateCells";
import { exportWorkbookToXlsxBlob } from "./excelIO";
import { createEmptySheet, setCellRaw, setRangeFormat, SheetModel } from "./sheet";
import { computeSheet, resetComputeCache } from "./sheetCompute";
import { serialOf } from "./excelDate";

/**
 * Dates in a sheet (#45), through the engine as a cell sees it.
 *
 * The issue's own table: 2024-01-15, 2024-02-20, 2024-01-15 14:30 and 09:45, with `=A2-A1`,
 * `=A1+30` and `=A3*24` beside them. Every expected value is what Excel gives for the same cells.
 */
function sheetWith(cells: Record<string, string>): SheetModel {
  let s = createEmptySheet(12, 6);
  for (const [ref, raw] of Object.entries(cells)) s = setCellRaw(s, Number(ref.slice(1)) - 1, ref.charCodeAt(0) - 65, raw);
  return s;
}
const at = (s: SheetModel, ref: string) => {
  const c = computeSheet(s);
  const r = Number(ref.slice(1)) - 1;
  const col = ref.charCodeAt(0) - 65;
  return { value: c.values[r][col], display: c.display[r][col] };
};

beforeEach(() => resetComputeCache());

describe("a typed ISO date is a date (#45)", () => {
  const s = sheetWith({
    A1: "2024-01-15",
    A2: "2024-02-20",
    A3: "2024-01-15 14:30",
    A4: "09:45",
    B1: "=A2-A1",
    B2: "=A1+30",
    B3: "=A3*24",
    B4: "=A4*24",
  });

  it("holds the Excel serial and still shows what was typed", () => {
    expect(at(s, "A1")).toEqual({ value: 45306, display: "2024-01-15" });
    expect(at(s, "A3").value).toBeCloseTo(45306 + 14.5 / 24, 10);
    expect(at(s, "A3").display).toBe("2024-01-15 14:30");
    expect(at(s, "A4")).toEqual({ value: 0.40625, display: "09:45" });
  });

  it("does date arithmetic the way Excel does", () => {
    expect(at(s, "B1").value).toBe(36);
    expect(at(s, "B2").value).toBe(serialOf(2024, 2, 14));
    expect(at(s, "B3").value).toBeCloseTo(45306 * 24 + 14.5, 6);
    expect(at(s, "B4").value).toBeCloseTo(9.75, 10);
  });

  it("shows a formula's date as a number until it is given a date format — then as a date", () => {
    expect(at(s, "B2").display).toBe(String(serialOf(2024, 2, 14)));
    const dated = setRangeFormat(s, 1, 1, 1, 1, { numberFormat: "date" });
    expect(at(dated, "B2").display).toBe("2024-02-14");
    const own = setRangeFormat(s, 1, 1, 1, 1, { numberFormat: "date", dateFormat: "dd/mm/yyyy" });
    expect(at(own, "B2").display).toBe("14/02/2024");
  });

  it("leaves other layouts as the text they are, and an apostrophe keeps an ISO date text", () => {
    const t = sheetWith({ A1: "15/1/2024", A2: "'2024-01-15", A3: "2024-02-30", B1: "=A1+1", B2: "=A2+1" });
    expect(at(t, "A1").value).toBe("15/1/2024");
    expect(at(t, "A2").value).toBe("2024-01-15");
    expect(at(t, "A3").value).toBe("2024-02-30");
    expect(at(t, "B1").display).toBe("#VALUE!");
    // Text that is an ISO date still means that date in arithmetic, as it does in Excel.
    expect(at(t, "B2").value).toBe(45307);
  });
});

describe("the date functions read a serial and ISO text alike (#45)", () => {
  it("YEAR, MONTH, DAY and DATEDIF on a date cell and on quoted text", () => {
    const s = sheetWith({
      A1: "2024-01-15",
      A2: "2027-03-20",
      B1: "=YEAR(A1)",
      B2: "=MONTH(A1)",
      B3: "=DAY(A1)",
      B4: '=DATEDIF(A1,A2,"Y")',
      B5: '=DATEDIF(A1,A2,"YM")',
      B6: '=YEAR("2024-01-15")',
      B7: "=DAY(A1+17)",
      B8: '=DATEDIF("2024-01-15",A2,"D")',
    });
    expect([at(s, "B1").value, at(s, "B2").value, at(s, "B3").value]).toEqual([2024, 1, 15]);
    expect([at(s, "B4").value, at(s, "B5").value]).toEqual([3, 2]);
    expect(at(s, "B6").value).toBe(2024);
    expect(at(s, "B7").value).toBe(1);
    expect(at(s, "B8").value).toBe(serialOf(2027, 3, 20) - 45306);
  });

  it("TODAY and NOW are serials, and agree about the day", () => {
    const s = sheetWith({ A1: "=TODAY()", A2: "=NOW()", A3: "=INT(A2)-A1" });
    expect(typeof at(s, "A1").value).toBe("number");
    expect(Number.isInteger(at(s, "A1").value)).toBe(true);
    expect(at(s, "A3").value).toBe(0);
  });
});

describe("a sheet saved before #45 opens with dates (#45)", () => {
  it("reads the ISO text it already holds as dates, with nothing migrated", () => {
    // Exactly what the old importer wrote into a cell: the ISO date, no format.
    const saved = sheetWith({ A1: "2024-01-15", A2: "=A1+1" });
    expect(saved.formats[0]?.[0]?.numberFormat).toBeUndefined();
    expect(at(saved, "A1").display).toBe("2024-01-15");
    expect(at(saved, "A2").value).toBe(45307);
  });
});

/**
 * Where a date is a label, not a number (#45): a chart's axis, a CSV, a cell in the exported file.
 * Its value being a serial is right for arithmetic and wrong for all three.
 */
describe("dates used as labels and written out (#45)", () => {
  const sales = sheetWith({ A1: "day", B1: "sales", A2: "2024-01-15", B2: "10", A3: "2024-01-16", B3: "20" });

  it("labels a chart's rows with the dates the grid shows, rather than plotting them", () => {
    const c = computeSheet(sales);
    const range = { startRow: 0, startCol: 0, endRow: 2, endCol: 1 };
    const data = chartDataFrom(c.values, range, dateTextReader(sales, c));
    expect(data.labels).toEqual(["2024-01-15", "2024-01-16"]);
    expect(data.series.map((s) => s.name)).toEqual(["sales"]);
  });

  it("writes a CSV's dates as ISO text, not serials", () => {
    const withTime = setRangeFormat(sheetWith({ A1: "2024-01-15", A2: "=A1+0.5" }), 1, 0, 1, 0, { numberFormat: "datetime" });
    const values = valuesWithIsoDates(withTime, computeSheet(withTime));
    expect([values[0][0], values[1][0]]).toEqual(["2024-01-15", "2024-01-15 12:00"]);
  });

  it("exports a typed date as a real date cell that Excel reads back as the same date", async () => {
    const s = sheetWith({ A1: "2024-01-15", A2: "2024-01-15 14:30", A3: "09:45", A4: "=A1+1" });
    const dated = setRangeFormat(s, 3, 0, 3, 0, { numberFormat: "date", dateFormat: "dd/mm/yyyy" });
    const blob = await exportWorkbookToXlsxBlob([{ name: "Dates", sheet: dated, computed: computeSheet(dated) }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.worksheets[0];
    // ExcelJS hands back a Date for a numeric cell with a date format — the test Excel itself passes.
    expect(ws.getCell("A1").value).toEqual(new Date(Date.UTC(2024, 0, 15)));
    expect(ws.getCell("A1").numFmt).toBe("yyyy-mm-dd");
    expect(ws.getCell("A2").value).toEqual(new Date(Date.UTC(2024, 0, 15, 14, 30)));
    expect(ws.getCell("A2").numFmt).toBe("yyyy-mm-dd hh:mm");
    expect(ws.getCell("A3").numFmt).toBe("hh:mm");
    expect(ws.getCell("A4").numFmt).toBe("dd/mm/yyyy");
  });
});
