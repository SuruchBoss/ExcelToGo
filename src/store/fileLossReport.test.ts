// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
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
