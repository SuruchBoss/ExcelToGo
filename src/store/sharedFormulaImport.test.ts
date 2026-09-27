// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import ExcelJS from "exceljs";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeSheet } from "@/lib/sheet";
import { ruleAt } from "@/lib/dataValidation";
import { useSheetStore } from "./sheetStore";

/**
 * Formulas filled down or across in Excel, through the store's own import (#44).
 *
 * Excel stores a filled range as one *shared formula*: the first cell carries the text, the rest
 * point back at it. Only the first was read as a formula; every other cell arrived as the number it
 * last showed, stopped following its inputs, and the next export wrote the numbers — the formulas
 * were gone for good, with nothing on screen to say so.
 */
const downloads: Blob[] = [];
vi.mock("@/lib/excelIO", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/excelIO")>()),
  downloadBlob: (blob: Blob) => void downloads.push(blob),
}));

const state = () => useSheetStore.getState();
const sheet = () => state().sheets[0].sheet;

beforeEach(() => {
  downloads.length = 0;
  state().startBlank();
});

/** A value ExcelJS writes as a shared formula: the master carries the text and the range. */
type Shared = { formula: string; result: unknown; shareType: "shared"; ref: string } | { sharedFormula: string; result: unknown };
const set = (ws: ExcelJS.Worksheet, address: string, value: Shared) => {
  ws.getCell(address).value = value as ExcelJS.CellValue;
};

/**
 * A1:A5 hold 1–5, B1 holds `=A1*10` filled down to B5 — and B holds the text of the first one only,
 * as Excel writes it. Also a fill *across*, an absolute reference, and a string that looks like an
 * address.
 */
async function filledWorkbook(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Fill");
  for (let r = 1; r <= 5; r++) ws.getCell(r, 1).value = r;
  set(ws, "B1", { formula: "A1*10", result: 10, shareType: "shared", ref: "B1:B5" });
  for (let r = 2; r <= 5; r++) set(ws, `B${r}`, { sharedFormula: "B1", result: r * 10 });

  set(ws, "C1", { formula: "$A$1+A1", result: 2, shareType: "shared", ref: "C1:C3" });
  for (let r = 2; r <= 3; r++) set(ws, `C${r}`, { sharedFormula: "C1", result: 1 + r });

  set(ws, "D1", { formula: 'IF(A1>1,"Q1 "&A1,"see A1")', result: "see A1", shareType: "shared", ref: "D1:D3" });
  for (let r = 2; r <= 3; r++) set(ws, `D${r}`, { sharedFormula: "D1", result: `Q1 ${r}` });

  // Across a row: A7:C7 are 100/200/300, A8 is `=A7/100` filled right to C8.
  [100, 200, 300].forEach((n, i) => (ws.getCell(7, i + 1).value = n));
  set(ws, "A8", { formula: "A7/100", result: 1, shareType: "shared", ref: "A8:C8" });
  set(ws, "B8", { sharedFormula: "A8", result: 2 });
  set(ws, "C8", { sharedFormula: "A8", result: 3 });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

describe("a filled-down formula stays a formula in every cell (#44)", () => {
  it("the fixture really is a shared formula, not five separate ones", async () => {
    const xml = await (await JSZip.loadAsync(await filledWorkbook())).file("xl/worksheets/sheet1.xml")!.async("string");
    expect(xml).toContain('<f t="shared" ref="B1:B5" si="0">A1*10</f>');
    expect(xml.match(/<c r="B[2-5]"[^>]*><f t="shared" si="0"\/>/g)).toHaveLength(4);
  });

  it("every filled cell arrives with its own references, and follows its input", async () => {
    await state().importFromFile(new File([await filledWorkbook()], "fill.xlsx"));
    expect(sheet().cells.slice(0, 5).map((row) => row[1])).toEqual(["=A1*10", "=A2*10", "=A3*10", "=A4*10", "=A5*10"]);

    state().setCellRaw(1, 0, "7"); // A2
    expect(computeSheet(sheet()).values[1][1]).toBe(70);
  });

  it("keeps an absolute reference where it was, and fills across a row as well as down", async () => {
    await state().importFromFile(new File([await filledWorkbook()], "fill.xlsx"));
    expect(sheet().cells[2][2]).toBe("=$A$1+A3");
    expect([sheet().cells[7][1], sheet().cells[7][2]]).toEqual(["=B7/100", "=C7/100"]);
  });

  it("leaves text inside quotes alone, even when it looks like an address", async () => {
    await state().importFromFile(new File([await filledWorkbook()], "fill.xlsx"));
    expect(sheet().cells[2][3]).toBe('=IF(A3>1,"Q1 "&A3,"see A1")');
  });

  it("survives export and import again, every cell still a formula", async () => {
    await state().importFromFile(new File([await filledWorkbook()], "fill.xlsx"));
    await state().exportXlsx();
    await state().importFromFile(new File([await downloads[0].arrayBuffer()], "again.xlsx"));
    expect(sheet().cells.slice(0, 5).map((row) => row[1])).toEqual(["=A1*10", "=A2*10", "=A3*10", "=A4*10", "=A5*10"]);
    expect(sheet().cells[7][2]).toBe("=C7/100");
  });

  it("a dropdown that lists filled-down cells offers their results, not their formulas", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Lists");
    for (let r = 1; r <= 3; r++) ws.getCell(r, 1).value = r;
    set(ws, "B1", { formula: "A1*10", result: 10, shareType: "shared", ref: "B1:B3" });
    for (let r = 2; r <= 3; r++) set(ws, `B${r}`, { sharedFormula: "B1", result: r * 10 });
    ws.getCell("D1").dataValidation = { type: "list", allowBlank: true, formulae: ["$B$1:$B$3"] };
    await state().importFromFile(new File([await wb.xlsx.writeBuffer()], "lists.xlsx"));
    expect(ruleAt(sheet(), 0, 3)).toEqual({ kind: "list", values: ["10", "20", "30"] });
  });
});
