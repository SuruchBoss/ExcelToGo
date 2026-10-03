// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportWorkbookToXlsxBlob } from "@/lib/excelIO";
import { computeSheet, createEmptySheet } from "@/lib/sheet";
import { selectFileLosses, undoSheet, useSheetStore } from "./sheetStore";

/**
 * The report of what an opened file cannot keep, through the store (#83): it comes up as the file
 * opens, only when there is something to say, stays for as long as the file's tabs are open, and
 * goes with them — undoing the open, or opening a clean file over it.
 */
const state = () => useSheetStore.getState();
const fixture = () =>
  new File([Uint8Array.from(readFileSync(new URL("../lib/fixtures/losses-picture-chart.xlsx", import.meta.url)))], "ใบเสนอราคา.xlsx");

async function cleanFile() {
  const sheet = createEmptySheet();
  sheet.cells[0][0] = "10";
  const blob = await exportWorkbookToXlsxBlob([{ name: "Sheet1", sheet, computed: computeSheet(sheet) }]);
  return new File([await blob.arrayBuffer()], "clean.xlsx");
}

/** The fixture with a range name the importer cannot bring in (#60): a whole column. */
async function fixtureWithName() {
  const zip = await JSZip.loadAsync(readFileSync(new URL("../lib/fixtures/losses-picture-chart.xlsx", import.meta.url)));
  const wb = (await zip.file("xl/workbook.xml")!.async("string")).replace(
    "</sheets>",
    `</sheets><definedNames><definedName name="WholeColumn">'ข้อมูล'!$B:$B</definedName></definedNames>`
  );
  zip.file("xl/workbook.xml", wb);
  return new File([Uint8Array.from(await zip.generateAsync({ type: "uint8array" }))], "ใบเสนอราคา.xlsx");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  state().startBlank();
  useSheetStore.setState({ fileLosses: null, fileLossesOpen: false });
  useSheetStore.temporal.getState().clear();
});

describe("the report of what an opened file cannot keep (#83)", () => {
  it("comes up as the file opens, with what it found and where", async () => {
    await state().importFromFile(fixture());
    const report = selectFileLosses(state());
    expect(report?.fileName).toBe("ใบเสนอราคา.xlsx");
    expect(report?.items.map((i) => `${i.kind}:${i.count}:${i.sheets.join()}`)).toEqual([
      "pictures:1:ใบเสนอราคา",
      "charts:1:ใบเสนอราคา",
      "unknownFunctions:1:ใบเสนอราคา",
    ]);
    expect(state().fileLossesOpen).toBe(true);
  });

  it("says the range names that could not come in, in the report rather than an alert of their own (#60)", async () => {
    const alert = vi.fn();
    vi.stubGlobal("alert", alert);
    await state().importFromFile(await fixtureWithName());
    const names = selectFileLosses(state())?.items.find((i) => i.kind === "names");
    expect(names).toEqual({ kind: "names", count: 1, sheets: [], names: ["WholeColumn"] });
    expect(state().fileLossesOpen).toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });

  it("a file with nothing to lose shows nothing", async () => {
    await state().importFromFile(await cleanFile());
    expect(selectFileLosses(state())).toBeNull();
    expect(state().fileLossesOpen).toBe(false);
  });

  it("closes, opens again from the menu, and goes when a clean file replaces it", async () => {
    await state().importFromFile(fixture());
    state().closeFileLosses();
    expect(state().fileLossesOpen).toBe(false);
    state().showFileLosses();
    expect(state().fileLossesOpen).toBe(true);
    await state().importFromFile(await cleanFile());
    expect(selectFileLosses(state())).toBeNull();
  });

  it("goes with the file's tabs when the open is undone", async () => {
    state().setCellRaw(0, 0, "work");
    await state().importFromFile(fixture(), "append");
    expect(selectFileLosses(state())).not.toBeNull();
    undoSheet();
    expect(state().sheets.map((t) => t.name)).toEqual(["Sheet1"]);
    expect(selectFileLosses(state())).toBeNull();
  });
});
