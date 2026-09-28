// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { readWorkbook } from "./cloud/workbook";
import { exportWorkbookToXlsxBlob, importWorkbookFromFile } from "./excelIO";
import { createEmptySheet, setCellRaw, setRangeFormat } from "./sheet";
import { LEGACY_PERCENT_CODE, toStorage, withLegacyPercent } from "./sheetCodec";
import { computeSheet } from "./sheetCompute";

/**
 * Percent, currency and decimals as Excel shows them (#53). The issue's table, both ways through a
 * real .xlsx: a file's own codes are shown and written back as they came, and the app's Percent is
 * Excel's — the value ×100 — on screen and in the file.
 */
async function issueFile(): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Formats");
  const rows: [number, string][] = [
    [0.07, "0%"],
    [0.125, "0.0%"],
    [1234.5, '"$"#,##0.00'],
    [1.2345, "0.000"],
    [12345, "#,##0"],
    [50, LEGACY_PERCENT_CODE], // what this app used to export for "Percent"
  ];
  rows.forEach(([value, code], i) => {
    ws.getCell(i + 1, 1).value = value;
    ws.getCell(i + 1, 1).numFmt = code;
  });
  return new File([await wb.xlsx.writeBuffer()], "formats.xlsx");
}

describe("a file's number formats (#53)", () => {
  it("show what Excel shows", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await issueFile());
    const shown = computeSheet(sheet).display.slice(0, 6).map((r) => r[0]);
    expect(shown).toEqual(["7%", "12.5%", "$1,234.50", "1.235", "12,345", "50.00%"]);
  });

  it("go back out as the same codes and the same values", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await issueFile());
    const blob = await exportWorkbookToXlsxBlob([{ name: "Formats", sheet, computed: computeSheet(sheet) }]);
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(await blob.arrayBuffer());
    const ws = back.worksheets[0];
    const cells = [1, 2, 3, 4, 5, 6].map((r) => [ws.getCell(r, 1).value, ws.getCell(r, 1).numFmt]);
    expect(cells).toEqual([
      [0.07, "0%"],
      [0.125, "0.0%"],
      [1234.5, '"$"#,##0.00'],
      [1.2345, "0.000"],
      [12345, "#,##0"],
      [50, LEGACY_PERCENT_CODE],
    ]);
  });
});

describe("the app's own Percent is Excel's (#53)", () => {
  it("shows the fraction ×100 and exports a real percent format", async () => {
    let sheet = setCellRaw(createEmptySheet(), 0, 0, "0.3846");
    sheet = setCellRaw(sheet, 1, 0, "=3040/6435");
    sheet = setRangeFormat(sheet, 0, 0, 1, 0, { numberFormat: "percent" });
    const computed = computeSheet(sheet);
    expect(computed.display[0][0]).toBe("38.46%");
    expect(computed.display[1][0]).toBe("47.24%");

    const blob = await exportWorkbookToXlsxBlob([{ name: "P", sheet, computed }]);
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(await blob.arrayBuffer());
    expect(back.worksheets[0].getCell("A1").numFmt).toBe("0.00%");
    expect(back.worksheets[0].getCell("A1").value).toBe(0.3846);
  });
});

describe("a sheet saved before percent meant ×100", () => {
  const legacy = () => setRangeFormat(setCellRaw(createEmptySheet(), 0, 0, "50"), 0, 0, 0, 0, { numberFormat: "percent" });

  it("still shows 50.00%, from the autosave in either shape", () => {
    const dense = withLegacyPercent(legacy());
    expect(computeSheet(dense).display[0][0]).toBe("50.00%");
    const packed = withLegacyPercent(toStorage(legacy()));
    expect(packed.formats?.["0,0"]?.numFmtCode).toBe(LEGACY_PERCENT_CODE);
  });

  it("still shows 50.00% from a cloud workbook of format 1, and a format-2 one is read as it is", () => {
    const tab = { id: "a", name: "Sheet1", sheet: legacy() };
    const old = readWorkbook({ format: 1, sheets: [tab] })!;
    expect(computeSheet(old[0].sheet).display[0][0]).toBe("50.00%");
    const current = readWorkbook({ format: 2, sheets: [tab] })!;
    expect(computeSheet(current[0].sheet).display[0][0]).toBe("5000.00%");
  });
});
