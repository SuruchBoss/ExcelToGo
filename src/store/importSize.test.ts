// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IMPORT_MAX_ROWS } from "@/lib/excelIO";
import { cellKey } from "@/lib/sheetTemplate";
import { ruleAt } from "@/lib/dataValidation";
import { fromStorage, toStorage } from "@/lib/sheetCodec";
import { useSheetStore } from "./sheetStore";

/**
 * How big a sheet opens from a file, through the store's own import (#43, and the part of #10 that
 * lives in the same code).
 *
 * The size came from ExcelJS's `actualRowCount`/`actualColumnCount`, which *count* the rows and
 * columns holding something. Any gap made the count smaller than the last index, and everything past
 * the count was dropped without a word — including from files the app had written itself.
 */
const downloads: Blob[] = [];
vi.mock("@/lib/excelIO", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/excelIO")>()),
  downloadBlob: (blob: Blob) => void downloads.push(blob),
}));

const alerts: string[] = [];
beforeEach(() => {
  alerts.length = 0;
  downloads.length = 0;
  vi.stubGlobal("alert", (message: string) => void alerts.push(message));
  useSheetStore.getState().startBlank();
});
afterEach(() => vi.unstubAllGlobals());

const state = () => useSheetStore.getState();
const tab = (i = 0) => state().sheets[i];

/** ExcelJS has range-wide rules but leaves them out of its types. */
const rulesOf = (ws: ExcelJS.Worksheet) =>
  (ws as unknown as { dataValidations: { add(range: string, rule: ExcelJS.DataValidation): void } }).dataValidations;

async function fileOf(build: (wb: ExcelJS.Workbook) => void | Promise<void>, name = "in.xlsx"): Promise<File> {
  const wb = new ExcelJS.Workbook();
  await build(wb);
  return new File([await wb.xlsx.writeBuffer()], name);
}

describe("an import keeps every cell up to the last one the file holds (#43)", () => {
  it("the app's own export comes back whole: a total below a gap is still there", async () => {
    state().setCellRaw(0, 0, "Revenue");
    state().setCellRaw(0, 1, "100");
    state().setCellRaw(24, 0, "Total");
    state().setCellRaw(24, 1, "=B1");
    await state().exportXlsx();
    expect(downloads).toHaveLength(1);

    await state().importFromFile(new File([await downloads[0].arrayBuffer()], "ExcelToGo.xlsx"));
    const cells = tab().sheet.cells;
    expect(cells[24][0]).toBe("Total");
    expect(cells[24][1]).toBe("=B1");
    expect(alerts).toEqual([]);
  });

  it("a blank separator row and a blank column do not cost the last row or the last column", async () => {
    const file = await fileOf((wb) => {
      const ws = wb.addWorksheet("Data");
      for (let r = 1; r <= 25; r++) {
        if (r === 13) continue; // the separator row
        for (let c = 1; c <= 12; c++) {
          if (c === 6) continue; // column F left empty
          ws.getCell(r, c).value = `r${r}c${c}`;
        }
      }
    });
    await state().importFromFile(file);
    const { sheet } = tab();
    expect(sheet.rows).toBeGreaterThanOrEqual(25);
    expect(sheet.cols).toBeGreaterThanOrEqual(12);
    expect(sheet.cells[24][11]).toBe("r25c12"); // L25
    expect(sheet.cells[24][0]).toBe("r25c1");
    expect(sheet.cells[0][11]).toBe("r1c12");
  });

  it("three lone cells far apart all arrive", async () => {
    const file = await fileOf((wb) => {
      const ws = wb.addWorksheet("Sparse");
      ws.getCell("A1").value = "top-left";
      ws.getCell("A50").value = "far down";
      ws.getCell("Z1").value = "far right";
    });
    await state().importFromFile(file);
    const cells = tab().sheet.cells;
    expect(cells[0][0]).toBe("top-left");
    expect(cells[49][0]).toBe("far down");
    expect(cells[0][25]).toBe("far right");
  });

  // Its own timeout, not the suite's: the file really does run past the row ceiling, and writing and
  // reading one that long takes 3–5 s on a busy machine — over Vitest's 5 s default on the PO's
  // runs of #168 while main already took 4–4.8 s. What it checks is the clip and the alert, not
  // the speed, so the limit only has to stop a hang.
  it("past the ceiling the sheet opens clipped, and says so instead of dropping rows quietly", { timeout: 30_000 }, async () => {
    const last = IMPORT_MAX_ROWS + 5;
    const file = await fileOf((wb) => {
      const ws = wb.addWorksheet("Huge");
      ws.getCell("A1").value = "first";
      ws.getCell(last, 1).value = "beyond";
    });
    await state().importFromFile(file);
    const { sheet } = tab();
    expect(sheet.rows).toBe(IMPORT_MAX_ROWS);
    expect(sheet.cells[0][0]).toBe("first");
    expect(alerts).toHaveLength(1);
    // The message names the sheet and both numbers, in the reader's own digits.
    expect(alerts[0]).toContain("Huge");
    expect(alerts[0]).toContain(last.toLocaleString("en-US"));
    expect(alerts[0]).toContain(IMPORT_MAX_ROWS.toLocaleString("en-US"));
  });
});

describe("empty rows that a form still needs are part of the sheet (#10)", () => {
  /** A form shaped like the ERP contract: fields that go on well past the rows filled in. */
  function erpLikeForm(wb: ExcelJS.Workbook) {
    const sheets: [string, number][] = [
      ["Items", 200],
      ["Locations", 50],
    ];
    return Promise.all(
      sheets.map(async ([name, lastRow]) => {
        const ws = wb.addWorksheet(name);
        ws.getCell("A1").value = "code";
        ws.getCell("B1").value = "unit";
        for (let r = 2; r <= lastRow; r++) {
          ws.getCell(r, 1).protection = { locked: false };
          ws.getCell(r, 2).protection = { locked: false };
          ws.getCell(r, 2).dataValidation = { type: "list", allowBlank: true, formulae: ['"kg,pcs"'] };
        }
        await ws.protect("", { selectLockedCells: true, selectUnlockedCells: true });
      })
    ).then(async () => {
      // Filled rows followed by one more unlocked row, with no rule anywhere: only the unlocked
      // flag says the sheet goes that far.
      const ws = wb.addWorksheet("OpeningBalance");
      ws.getCell("A1").value = "qty";
      for (let r = 2; r <= 231; r++) {
        if (r <= 230) ws.getCell(r, 1).value = r;
        for (let c = 1; c <= 3; c++) ws.getCell(r, c).protection = { locked: false };
      }
      await ws.protect("", { selectLockedCells: true, selectUnlockedCells: true });
    });
  }

  it("a protected form opens with every unlocked row, and they are still unlocked after export", async () => {
    await state().importFromFile(await fileOf(erpLikeForm, "form.xlsx"));
    const [items, locations] = [tab(0).sheet, tab(1).sheet];
    expect(items.rows).toBeGreaterThanOrEqual(200);
    expect(locations.rows).toBeGreaterThanOrEqual(50);
    expect(items.template?.inputs[cellKey(199, 0)]).toBe(true); // A200
    expect(items.template?.choices[cellKey(199, 1)]).toEqual(["kg", "pcs"]);
    expect(locations.template?.inputs[cellKey(49, 1)]).toBe(true); // B50
    const opening = tab(2).sheet;
    expect(opening.rows).toBeGreaterThanOrEqual(231);
    expect(opening.template?.inputs[cellKey(230, 2)]).toBe(true); // C231, empty and unlocked

    // What autosave writes and a reload reads back keeps them too.
    const reloaded = fromStorage(JSON.parse(JSON.stringify(toStorage(items))));
    expect(reloaded.rows).toBe(items.rows);
    expect(reloaded.template?.inputs[cellKey(199, 0)]).toBe(true);

    await state().exportXlsx();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await downloads[0].arrayBuffer());
    const ws = wb.getWorksheet("Items")!;
    expect(ws.getCell("A200").protection?.locked).toBe(false);
    expect(ws.getCell("B200").dataValidation?.type).toBe("list");
  });

  it("the ERP's own draft-0 template meets its row contract, opened and exported", async () => {
    // The contract (ERP commit 0ebd35b): Items rows 2–200, Locations 2–50, OpeningBalance 2 to
    // max(200, pre-filled + 1). Its values stop by row 10, which is all the old sizing looked at.
    const { readFileSync } = await import("node:fs");
    const bytes = readFileSync(new URL("../lib/fixtures/payneat-erp-sample-import-template.xlsx", import.meta.url));
    await state().importFromFile(new File([bytes], "sample-import-template.xlsx"));
    const contract: [string, number][] = [
      ["Items", 200],
      ["Locations", 50],
      ["OpeningBalance", 200],
    ];
    for (const [name, last] of contract) {
      const sheet = state().sheets.find((t) => t.name === name)!.sheet;
      expect(sheet.rows, name).toBe(last);
      expect(sheet.template?.inputs[cellKey(last - 1, 0)], name).toBe(true);
    }

    await state().exportXlsx();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await downloads[0].arrayBuffer());
    for (const [name, last] of contract) {
      const ws = wb.getWorksheet(name)!;
      for (let r = 2; r <= last; r++) expect(ws.getCell(r, 1).protection?.locked, `${name}!A${r}`).toBe(false);
    }
    // One list column per sheet, checked down to its last contracted row.
    expect(wb.getWorksheet("Items")!.getCell("D200").dataValidation?.type).toBe("list");
    expect(wb.getWorksheet("Locations")!.getCell("D50").dataValidation?.type).toBe("list");
    expect(wb.getWorksheet("OpeningBalance")!.getCell("B200").dataValidation?.type).toBe("list");
  });

  it("an ordinary file keeps a rule that sits on empty rows after the data", async () => {
    const file = await fileOf((wb) => {
      const ws = wb.addWorksheet("Scores");
      ws.getCell("A1").value = "score";
      ws.getCell("A2").value = 5;
      rulesOf(ws).add("A2:A60", { type: "whole", operator: "between", allowBlank: true, formulae: [0, 10] });
    });
    await state().importFromFile(file);
    const { sheet } = tab();
    expect(sheet.rows).toBeGreaterThanOrEqual(60);
    expect(ruleAt(sheet, 59, 0)).toMatchObject({ kind: "number", min: 0, max: 10 }); // A60
  });

  it("a rule on the whole column does not stretch the sheet to a million rows", async () => {
    const file = await fileOf((wb) => {
      const ws = wb.addWorksheet("Whole");
      ws.getCell("A1").value = "status";
      rulesOf(ws).add("B1:B1048576", { type: "list", allowBlank: true, formulae: ['"open,closed"'] });
    });
    await state().importFromFile(file);
    const { sheet } = tab();
    expect(sheet.rows).toBeLessThan(100);
    // …and it still applies to every row the sheet does have.
    expect(ruleAt(sheet, sheet.rows - 1, 1)).toMatchObject({ kind: "list" });
    expect(alerts).toEqual([]);
  });
});
