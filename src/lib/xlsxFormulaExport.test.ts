// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeSheet } from "./sheet";
import { isError } from "./formulaEngine/types";
import { useSheetStore } from "@/store/sheetStore";

/**
 * What an `.xlsx` export writes as a formula.
 *
 * Only what this engine can read. A formula it cannot parse is not something the app can vouch for
 * — here it is an error, whatever it would do in the next program — so it goes out as the text it
 * is, while every formula the engine does read still goes out as a formula.
 */
const downloads: Blob[] = [];
vi.mock("@/lib/excelIO", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/excelIO")>()),
  downloadBlob: (blob: Blob) => void downloads.push(blob),
}));

const state = () => useSheetStore.getState();

beforeEach(() => {
  downloads.length = 0;
  state().startBlank();
});

/** Unreadable to the engine: a pipe it has no operator for, and a string cut off half way. */
const PIPE = "=A|'B'!C1";
const CUT = '=HYPERLINK("https://example.com';

async function exported(): Promise<ExcelJS.Worksheet> {
  await state().exportXlsx();
  expect(downloads).toHaveLength(1);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await downloads[0].arrayBuffer());
  return wb.worksheets[0];
}

const formulaOf = (cell: ExcelJS.Cell) => {
  const v = cell.value;
  return v && typeof v === "object" && "formula" in v ? v.formula : undefined;
};

describe("xlsx export: only a formula the engine can read goes out as a formula", () => {
  it("from a CSV: a readable formula stays a formula, an unreadable one goes out as its text", async () => {
    const csv = `=1+1,"${PIPE.replace(/"/g, '""')}","${CUT.replace(/"/g, '""')}"\n`;
    await state().importFromFile(new File([csv], "in.csv", { type: "text/csv" }));
    expect(state().sheets[0].sheet.cells[0].slice(0, 3)).toEqual(["=1+1", PIPE, CUT]);

    const ws = await exported();
    expect(formulaOf(ws.getCell("A1"))).toBe("1+1");
    expect(ws.getCell("B1").value).toBe(PIPE);
    expect(ws.getCell("C1").value).toBe(CUT);
    expect(formulaOf(ws.getCell("B1"))).toBeUndefined();
    expect(formulaOf(ws.getCell("C1"))).toBeUndefined();
  });

  it("from an xlsx: a readable formula stays a formula, an unreadable one goes out as its text", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("S");
    ws.getCell("A1").value = 2;
    ws.getCell("B1").value = { formula: "A1*3", result: 6 };
    ws.getCell("C1").value = { formula: PIPE.slice(1), result: 0 };
    ws.getCell("D1").value = { formula: 'SUM(A1:A3)&"x"', result: "2x" };
    await state().importFromFile(new File([await wb.xlsx.writeBuffer()], "in.xlsx"));

    const out = await exported();
    expect(formulaOf(out.getCell("B1"))).toBe("A1*3");
    expect(formulaOf(out.getCell("D1"))).toBe('SUM(A1:A3)&"x"');
    expect(out.getCell("C1").value).toBe(PIPE);
  });

  it("changes nothing in the app: the cell still holds what was typed and still shows an error", () => {
    state().setCellRaw(0, 0, PIPE);
    const { sheet } = state().sheets[0];
    expect(sheet.cells[0][0]).toBe(PIPE);
    expect(isError(computeSheet(sheet).values[0][0])).toBe(true);
  });

  it("does not come back as a formula when the exported file is opened again", async () => {
    state().setCellRaw(0, 0, PIPE);
    state().setCellRaw(0, 1, "=1+1");
    await state().exportXlsx();
    await state().importFromFile(new File([await downloads[0].arrayBuffer()], "again.xlsx"));
    const cells = state().sheets[0].sheet.cells[0];
    expect(cells[1]).toBe("=1+1");
    // Text that starts with "=" arrives marked as text, the way any text cell does (#23).
    expect(cells[0]).toBe(`'${PIPE}`);
  });
});
