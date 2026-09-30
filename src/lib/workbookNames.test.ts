// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { exportWorkbookToXlsxBlob, importWorkbookFromFile, type ImportedSheet } from "./excelIO";
import { effectiveNames, visibleNames, withName } from "./namedRanges";
import { createEmptySheet, setCellRaw, type SheetModel } from "./sheet";
import { computeSheet, createWorkbookResolver } from "./sheetCompute";
import { renameSheetInFormulas, shiftOtherSheetsForStructuralOp } from "./workbookRefs";
import { addSheetLevelNames, readRawDefinedNames } from "./xlsxNames";

/**
 * A name belongs to the workbook, as in Excel (#60).
 *
 * Names were scoped to the sheet that held them, and a file's names were put on the sheet they
 * pointed at with the sheet taken off their target. So the accountant's `VatRate`, defined once for
 * the whole file, was `#NAME?` in every formula on every other sheet — 600 cells in round 3 — and
 * `Products!PriceTable`, the way Excel writes a sheet-level name from elsewhere, did not parse.
 */
type Tab = { name: string; sheet: SheetModel };

function sheetOf(cells: Record<string, string>, names?: SheetModel["names"]): SheetModel {
  let sheet = createEmptySheet(20, 6);
  for (const [ref, raw] of Object.entries(cells)) {
    sheet = setCellRaw(sheet, Number(ref.slice(1)) - 1, ref.charCodeAt(0) - 65, raw);
  }
  return names ? { ...sheet, names } : sheet;
}

/** Every tab computed the way the grid computes it, with the workbook behind it. */
function valuesOf(tabs: Tab[]) {
  const resolver = createWorkbookResolver(tabs);
  return tabs.map((t) => computeSheet(t.sheet, resolver).values);
}

/** The issue's workbook: `Lists` holds the data, `Data` holds the formulas. */
const LISTS = {
  A1: "North", B1: "10", A2: "South", B2: "20", A3: "East", B3: "30",
};

describe("a workbook-level name works from every sheet (#60)", () => {
  it("the issue's file: SUM(Rates) is 60 and the VLOOKUP into RateTable is 20, on another sheet", () => {
    const names = withName(withName(undefined, "Rates", "$B$1:$B$3"), "RateTable", "$A$1:$B$3");
    const tabs: Tab[] = [
      { name: "Lists", sheet: sheetOf(LISTS, names) },
      { name: "Data", sheet: sheetOf({ A1: "=SUM(Rates)", A2: '=VLOOKUP("South",RateTable,2,FALSE)' }) },
    ];
    const [lists, data] = valuesOf(tabs);
    expect(data[0][0]).toBe(60);
    expect(data[1][0]).toBe(20);
    // And on the sheet that holds it, as before.
    const own = valuesOf([{ ...tabs[0], sheet: setCellRaw(tabs[0].sheet, 5, 0, "=SUM(Rates)") }, tabs[1]])[0];
    expect(own[5][0]).toBe(60);
    expect(lists[0][1]).toBe(10);
  });

  it("a sheet-level name wins on its own sheet, stays out of the others, and is reachable as Sheet!Name", () => {
    const tabs: Tab[] = [
      { name: "Lists", sheet: sheetOf(LISTS, withName(undefined, "Rate", "$B$1")) },
      { name: "Local", sheet: sheetOf({ A1: "=Rate", B1: "99" }, withName(undefined, "Rate", "$B$1", "sheet")) },
      { name: "Other", sheet: sheetOf({ A1: "=Rate", A2: "=Local!Rate", A3: "='Local'!Rate*2" }) },
    ];
    const [, local, other] = valuesOf(tabs);
    expect(local[0][0]).toBe(99);
    expect(other[0][0]).toBe(10);
    expect(other[1][0]).toBe(99);
    expect(other[2][0]).toBe(198);
  });

  it("defining a name on one sheet recomputes a formula waiting for it on another", () => {
    const data = sheetOf({ A1: "=SUM(Rates)" });
    const before = valuesOf([{ name: "Lists", sheet: sheetOf(LISTS) }, { name: "Data", sheet: data }])[1];
    expect(before[0][0]).toMatchObject({ code: "#NAME?" });
    const after = valuesOf([
      { name: "Lists", sheet: sheetOf(LISTS, withName(undefined, "Rates", "$B$1:$B$3")) },
      { name: "Data", sheet: data },
    ])[1];
    expect(after[0][0]).toBe(60);
  });

  it("the names each sheet sees are the same object while nothing changes, so the caches hold", () => {
    const tabs: Tab[] = [
      { name: "Lists", sheet: sheetOf(LISTS, withName(undefined, "Rates", "$B$1:$B$3")) },
      { name: "Data", sheet: sheetOf({}) },
    ];
    expect(effectiveNames(tabs, 1)).toBe(effectiveNames([...tabs], 1));
    expect(effectiveNames(tabs, 1)?.RATES.ref).toBe("Lists!$B$1:$B$3");
    expect(effectiveNames(tabs, 0)?.RATES.ref).toBe("$B$1:$B$3");
  });

  it("the name box lists this sheet's own names and every workbook name, once each", () => {
    const tabs: Tab[] = [
      { name: "A", sheet: sheetOf({}, withName(withName(undefined, "Shared", "$A$1"), "Mine", "$B$1", "sheet")) },
      { name: "B", sheet: sheetOf({}, withName(undefined, "Shared", "$C$1")) },
    ];
    expect(visibleNames(tabs, 1).map((h) => `${h.entry.label}@${h.tabIndex}`)).toEqual(["Shared@0"]);
    expect(visibleNames(tabs, 0).map((h) => `${h.entry.label}@${h.tabIndex}`).sort()).toEqual(["Mine@0", "Shared@0"]);
  });

  it("a row inserted on the sheet a name points at moves it for every sheet; a rename keeps it", () => {
    const names = withName(withName(undefined, "Rates", "$B$1:$B$3"), "Far", "Lists!$B$2", "sheet");
    let tabs: Tab[] = [
      { name: "Lists", sheet: sheetOf(LISTS) },
      { name: "Data", sheet: sheetOf({ A1: "=SUM(Rates)", A2: "=Far" }, names) },
    ];
    // Names stored on Data but pointing at Lists move with Lists.
    const shifted = shiftOtherSheetsForStructuralOp(tabs, "Lists", "row", 0, 1);
    expect(shifted[1].names?.FAR.ref).toBe("Lists!$B$3");
    const renamed = renameSheetInFormulas(tabs, "Lists", "Rates2026");
    expect(renamed[1].names?.FAR.ref).toBe("Rates2026!$B$2");
    tabs = [{ name: "Rates2026", sheet: renamed[0] }, { name: "Data", sheet: renamed[1] }];
    expect(valuesOf(tabs)[1][1][0]).toBe(20);
  });

  it("a rename rewrites Sheet!Name in formulas as well", () => {
    const tabs: Tab[] = [
      { name: "Local", sheet: sheetOf({ B1: "5" }, withName(undefined, "Rate", "$B$1", "sheet")) },
      { name: "Other", sheet: sheetOf({ A1: "=Local!Rate+1" }) },
    ];
    const renamed = renameSheetInFormulas(tabs, "Local", "ใบอัตรา");
    expect(renamed[1].cells[0][0]).toBe("=ใบอัตรา!Rate+1");
  });
});

/** A workbook written by ExcelJS with the scopes Excel would write, `localSheetId` added after. */
async function fileWithScopes(extra: { name: string; localSheetId: number; text: string }[] = []): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const lists = wb.addWorksheet("Lists");
  for (const [ref, raw] of Object.entries(LISTS)) lists.getCell(ref).value = /^\d+$/.test(raw) ? Number(raw) : raw;
  const data = wb.addWorksheet("Data");
  data.getCell("A1").value = { formula: "SUM(Rates)" };
  data.getCell("A2").value = { formula: 'VLOOKUP("South",RateTable,2,FALSE)' };
  data.getCell("A3").value = { formula: "Rate" };
  data.getCell("B1").value = 7;
  wb.definedNames.model = [
    { name: "Rates", ranges: ["Lists!$B$1:$B$3"] },
    { name: "RateTable", ranges: ["Lists!$A$1:$B$3"] },
  ];
  const buffer = await addSheetLevelNames((await wb.xlsx.writeBuffer()) as ArrayBuffer, [
    // Sheet-level on Data, pointing at Data.
    { name: "Rate", localSheetId: 1, text: "Data!$B$1" },
    ...extra,
  ]);
  return new File([buffer], "scopes.xlsx");
}

function workbookOf(imported: ImportedSheet[]): Tab[] {
  return imported.map((t) => ({ name: t.name, sheet: t.sheet }));
}

describe("a file's names keep the scope the file gives them (#60)", () => {
  it("the issue's file opens computing 60 and 20, and the sheet-level Rate stays on Data", async () => {
    const imported = await importWorkbookFromFile(await fileWithScopes());
    const tabs = workbookOf(imported);
    const data = valuesOf(tabs)[1];
    expect(data[0][0]).toBe(60);
    expect(data[1][0]).toBe(20);
    expect(data[2][0]).toBe(7);
    expect(tabs[0].sheet.names?.RATES).toEqual({ label: "Rates", ref: "$B$1:$B$3" });
    expect(tabs[1].sheet.names?.RATE).toEqual({ label: "Rate", ref: "$B$1", scope: "sheet" });
    expect(imported[0].droppedNames).toBeUndefined();
  });

  it("a name it cannot bring in is named, not turned into #NAME? without a word", async () => {
    const imported = await importWorkbookFromFile(
      await fileWithScopes([
        { name: "Dynamic", localSheetId: 0, text: "OFFSET(Lists!$A$1,0,0,COUNTA(Lists!$A:$A),1)" },
        { name: "WholeColumn", localSheetId: 0, text: "Lists!$B:$B" },
        { name: "_xlnm._FilterDatabase", localSheetId: 0, text: "Lists!$A$1:$B$3" },
      ])
    );
    expect(imported[0].droppedNames).toEqual(["Dynamic", "WholeColumn"]);
  });

  it("export then import keeps every scope, and writes localSheetId for the sheet-level one", async () => {
    const first = workbookOf(await importWorkbookFromFile(await fileWithScopes()));
    const blob = await exportWorkbookToXlsxBlob(
      first.map((t) => ({ ...t, computed: computeSheet(t.sheet, createWorkbookResolver(first)) }))
    );
    const raw = await readRawDefinedNames(await blob.arrayBuffer());
    const rate = raw.names.find((n) => n.name === "Rate");
    expect(rate?.localSheetId).toBe(1);
    expect(raw.names.find((n) => n.name === "Rates")?.localSheetId).toBeUndefined();

    const again = workbookOf(await importWorkbookFromFile(new File([await blob.arrayBuffer()], "again.xlsx")));
    expect(again.map((t) => t.sheet.names)).toEqual(first.map((t) => t.sheet.names));
    expect(valuesOf(again)[1].slice(0, 3).map((r) => r[0])).toEqual([60, 20, 7]);
  });
});
