// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { chartDataFrom } from "./charts";
import { dateTextReader, valuesWithIsoDates } from "./dateCells";
import { exportWorkbookToXlsxBlob, importWorkbookFromFile } from "./excelIO";
import { createEmptySheet, setCellRaw, setRangeFormat, SheetModel } from "./sheet";
import { computeSheet, createWorkbookResolver, resetComputeCache } from "./sheetCompute";
import { BE_DATE_CODE, serialOf } from "./excelDate";
import { sortRange } from "./sheetSort";

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

/**
 * Dates through a real .xlsx (#45), both ways. The file is built with ExcelJS the way Excel writes
 * one: the issue's four cells, and a column with its own `dd/mm/yyyy` layout.
 */
describe("dates in and out of an .xlsx (#45)", () => {
  async function file(): Promise<File> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Dates");
    ws.getCell("A1").value = new Date(Date.UTC(2024, 0, 15));
    ws.getCell("A1").numFmt = "yyyy-mm-dd";
    ws.getCell("A2").value = new Date(Date.UTC(2024, 1, 20));
    ws.getCell("A2").numFmt = "mm-dd-yy";
    ws.getCell("A3").value = new Date(Date.UTC(2024, 0, 15, 14, 30));
    ws.getCell("A3").numFmt = "yyyy-mm-dd hh:mm";
    ws.getCell("A4").value = new Date(Date.UTC(1899, 11, 30, 9, 45));
    ws.getCell("A4").numFmt = "h:mm";
    ws.getCell("A5").value = new Date(Date.UTC(2026, 9, 2));
    ws.getCell("A5").numFmt = "dd/mm/yyyy";
    ws.getCell("A6").value = new Date(Date.UTC(1899, 11, 30));
    ws.getCell("A6").numFmt = "hh:mm";
    ws.getCell("B1").value = { formula: "A2-A1", result: 36 };
    ws.getCell("B2").value = { formula: "A1+30", result: 45336 };
    ws.getCell("B3").value = { formula: "A3*24", result: 1087358.5 };
    return new File([await wb.xlsx.writeBuffer()], "dates.xlsx");
  }

  it("imports dates as dates, keeping the time, and a time-only cell as a time", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await file());
    expect(sheet.cells.slice(0, 6).map((r) => r[0])).toEqual(["2024-01-15", "2024-02-20", "2024-01-15 14:30", "09:45", "2026-10-02", "00:00"]);
    const c = computeSheet(sheet);
    expect(c.values[0][1]).toBe(36);
    expect(c.values[2][1]).toBeCloseTo(45306 * 24 + 14.5, 6);
  });

  it("shows a date in the layout the file gave it", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await file());
    const c = computeSheet(sheet);
    expect(c.display[4][0]).toBe("02/10/2026");
    expect(c.display[0][0]).toBe("2024-01-15");
    // Excel's built-in short date follows the reader's locale; here it reads as the app's default.
    expect(c.display[1][0]).toBe("2024-02-20");
  });

  it("goes back out as the same dates, times and layouts", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await file());
    const blob = await exportWorkbookToXlsxBlob([{ name: "Dates", sheet, computed: computeSheet(sheet) }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.worksheets[0];
    expect(ws.getCell("A1").value).toEqual(new Date(Date.UTC(2024, 0, 15)));
    expect(ws.getCell("A3").value).toEqual(new Date(Date.UTC(2024, 0, 15, 14, 30)));
    expect(ws.getCell("A4").value).toEqual(new Date(Date.UTC(1899, 11, 30, 9, 45)));
    expect(ws.getCell("A5").value).toEqual(new Date(Date.UTC(2026, 9, 2)));
    expect(ws.getCell("A5").numFmt).toBe("dd/mm/yyyy");
  });
});

/**
 * The PaynEat ERP's own import template, round-tripped the way its users will (#45, PO's criteria):
 * open it, fill one cell, export, and read the file back. Every sheet keeps its size, and every date
 * cell is still a date, with the same value. The template carries expiry dates in
 * `OpeningBalance!F`, formatted `yyyy-mm-dd`. (Its date validation rule is not carried: the app has no
 * date rule yet, so it is dropped on import as before — a gap of its own, not this test's.)
 */
describe("the PaynEat ERP template round-trips its dates (#45)", () => {
  it("keeps every sheet's size and every date, after an edit and an export", async () => {
    const { readFileSync } = await import("node:fs");
    const bytes = readFileSync(new URL("./fixtures/payneat-erp-sample-import-template.xlsx", import.meta.url));
    const original = new ExcelJS.Workbook();
    await original.xlsx.load(new Uint8Array(bytes).buffer);

    const sheets = await importWorkbookFromFile(new File([bytes], "sample-import-template.xlsx"));
    const balances = sheets.find((s) => s.name === "OpeningBalance")!;
    balances.sheet = setCellRaw(balances.sheet, 1, 2, "42");
    const resolver = createWorkbookResolver(sheets);
    const blob = await exportWorkbookToXlsxBlob(sheets.map((s) => ({ ...s, computed: computeSheet(s.sheet, resolver) })));
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(await blob.arrayBuffer());

    let dates = 0;
    for (const ws of original.worksheets) {
      const out = back.getWorksheet(ws.name)!;
      expect(out.rowCount, ws.name).toBe(ws.rowCount);
      expect(out.columnCount, ws.name).toBe(ws.columnCount);
      ws.eachRow((row) =>
        row.eachCell((cell) => {
          if (!(cell.value instanceof Date)) return;
          dates++;
          expect(out.getCell(cell.address).value, `${ws.name}!${cell.address}`).toEqual(cell.value);
        })
      );
    }
    expect(dates).toBe(4);
    expect(back.getWorksheet("OpeningBalance")!.getCell("C2").value).toBe(42);
  });
});

/**
 * Buddhist-Era dates in a sheet (#82): typed or pasted as `15/01/2569`, they are the Gregorian date
 * they mean, so the arithmetic, DATEDIF and sorting are right, and the cell still shows what was typed.
 */
describe("a Buddhist-Era date in a sheet (#82)", () => {
  it("holds the Gregorian serial and still shows what was typed", () => {
    const s = sheetWith({ A1: "15/01/2569", A2: "15 ม.ค. 69", A3: "2569-01-15 13:45" });
    expect(at(s, "A1")).toEqual({ value: serialOf(2026, 1, 15), display: "15/01/2569" });
    expect(at(s, "A2")).toEqual({ value: serialOf(2026, 1, 15), display: "15 ม.ค. 69" });
    expect(at(s, "A3").value).toBeCloseTo(serialOf(2026, 1, 15) + (13 * 60 + 45) / 1440, 10);
  });

  it("DATEDIF between a Buddhist and a Gregorian date counts the real days; =DATE(2569,…) is still year 2569", () => {
    const s = sheetWith({
      A1: "15/01/2569",
      A2: "2026-03-01",
      A3: "1 มีนาคม 2569",
      B1: '=DATEDIF(A1,A2,"d")',
      B2: "=A3-A2",
      B3: "=YEAR(A1)",
      B4: "=YEAR(DATE(2569,1,15))",
      B5: '=DATEDIF("15/01/2569","15 ก.พ. 2569","d")',
    });
    expect(at(s, "B1").value).toBe(45);
    expect(at(s, "B2").value).toBe(0);
    expect(at(s, "B3").value).toBe(2026);
    expect(at(s, "B4").value).toBe(2569);
    expect(at(s, "B5").value).toBe(31);
  });

  it("sorts by the real date, whichever calendar each was typed in", () => {
    const s = sheetWith({ A1: "1 ก.พ. 2569", A2: "2025-12-31", A3: "15/01/2569", A4: "2026-01-01" });
    const sorted = sortRange(s, computeSheet(s), { startRow: 0, endRow: 3, startCol: 0, endCol: 0 }, 0, true);
    expect(sorted.cells.slice(0, 4).map((r) => r[0])).toEqual(["2025-12-31", "2026-01-01", "15/01/2569", "1 ก.พ. 2569"]);
  });

  it("goes out to Excel showing the Buddhist year, and a Buddhist format comes back in as one", async () => {
    const s = sheetWith({ A1: "15/01/2569", A2: "2026-01-15", A3: "15/01/2569 08:30" });
    const blob = await exportWorkbookToXlsxBlob([{ name: "BE", sheet: s, computed: computeSheet(s) }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.worksheets[0];
    expect(ws.getCell("A1").value).toEqual(new Date(Date.UTC(2026, 0, 15)));
    expect(ws.getCell("A1").numFmt).toBe(BE_DATE_CODE.date);
    expect(ws.getCell("A2").numFmt).toBe("yyyy-mm-dd");
    expect(ws.getCell("A3").numFmt).toBe(BE_DATE_CODE.datetime);

    const [{ sheet }] = await importWorkbookFromFile(new File([await wb.xlsx.writeBuffer()], "be.xlsx"));
    const back = computeSheet(sheet);
    expect(back.values[0][0]).toBe(serialOf(2026, 1, 15));
    expect(back.display[0][0]).toBe("15/1/2569");
    expect(back.display[2][0]).toBe("15/1/2569 8:30");
  });

  it("an .xlsx that shows dates in the Buddhist year shows them that way here", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Thai");
    const codes = ["[$-107041E]d mmm yy;@", "[$-1070000]dd/mm/yyyy;@", "dd/mm/bbbb", "[$-th-TH,107]d mmmm yyyy"];
    codes.forEach((code, i) => {
      ws.getCell(i + 1, 1).value = new Date(Date.UTC(2026, 0, 15));
      ws.getCell(i + 1, 1).numFmt = code;
    });
    const [{ sheet }] = await importWorkbookFromFile(new File([await wb.xlsx.writeBuffer()], "thai.xlsx"));
    const c = computeSheet(sheet);
    expect(c.display.slice(0, 4).map((r) => r[0])).toEqual(["15 ม.ค. 69", "15/01/2569", "15/01/2569", "15 มกราคม 2569"]);
    expect(c.values[0][0]).toBe(serialOf(2026, 1, 15));
  });
});
