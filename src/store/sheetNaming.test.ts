// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptySheet } from "@/lib/sheet";
import { toStorage } from "@/lib/sheetCodec";

/**
 * Sheet names through the store (#54), and what the exported file holds (#101 item 1).
 *
 * QA's four repros, as a person would meet them: a tab added after a delete, a rename onto a name
 * in use, a rename that differs only in case, and a character Excel refuses. Then a workbook
 * saved before any of this was checked, which is the one case where the names are already wrong
 * when the app sees them. The export is read back as XML, not through our own reader: the cached
 * `<v>` is what a phone preview or a LINE attachment shows, since those never recalculate.
 */

const downloads: Blob[] = [];
const failures = { next: false };
vi.mock("@/lib/excelIO", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/excelIO")>();
  return {
    ...real,
    downloadBlob: (blob: Blob) => void downloads.push(blob),
    exportWorkbookToXlsxBlob: (...args: Parameters<typeof real.exportWorkbookToXlsxBlob>) => {
      if (failures.next) {
        failures.next = false;
        return Promise.reject(new Error("Worksheet name already exists: sheet1"));
      }
      return real.exportWorkbookToXlsxBlob(...args);
    },
  };
});

const { computeTab, restoreSaved, useSheetStore } = await import("./sheetStore");
const state = () => useSheetStore.getState();
const tabNamed = (name: string) => state().sheets.find((t) => t.name === name)!;
const shown = (name: string, r: number, c: number) => computeTab(tabNamed(name).sheet, state().sheets).values[r][c];

/** The last download, unzipped: sheet names in order, and each sheet's XML by that name. */
async function exported() {
  const zip = await JSZip.loadAsync(await downloads[downloads.length - 1].arrayBuffer());
  const book = await zip.file("xl/workbook.xml")!.async("string");
  const names = [...book.matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => m[1]);
  const xml = async (i: number) => zip.file(`xl/worksheets/sheet${i + 1}.xml`)!.async("string");
  return { names, xml };
}

/** The `<f>` and `<v>` of one cell in a worksheet's XML. */
function cellXml(xml: string, ref: string) {
  const m = new RegExp(`<c r="${ref}"[^>]*>(.*?)</c>`).exec(xml)?.[1] ?? "";
  const text = (s: string | undefined) =>
    s?.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return { f: text(/<f>(.*?)<\/f>/.exec(m)?.[1]), v: text(/<v>(.*?)<\/v>/.exec(m)?.[1]) };
}

beforeEach(() => {
  state().startBlank();
  useSheetStore.temporal.getState().clear();
  downloads.length = 0;
});
afterEach(() => vi.unstubAllGlobals());

describe("names Excel refuses are never made (#54)", () => {
  it("(a) a tab added after a delete gets a free name, and the formula keeps its sheet", () => {
    state().addSheet();
    state().addSheet();
    state().setActiveSheet(tabNamed("Sheet3").id);
    state().setCellRaw(0, 0, "333");
    state().setActiveSheet(tabNamed("Sheet1").id);
    state().setCellRaw(0, 0, "=Sheet3!A1");
    state().deleteSheet(tabNamed("Sheet2").id);
    state().addSheet();
    expect(state().sheets.map((t) => t.name)).toEqual(["Sheet1", "Sheet3", "Sheet4"]);
    state().setCellRaw(0, 0, "999");
    expect(shown("Sheet1", 0, 0)).toBe(333);
  });

  it("(b) (c) (d) a rename onto a taken name, a case twin or a forbidden character is refused", () => {
    state().addSheet();
    state().setCellRaw(1, 0, "7");
    state().setActiveSheet(tabNamed("Sheet1").id);
    state().setCellRaw(0, 0, "=Sheet2!A2");
    const id = tabNamed("Sheet2").id;
    expect(state().renameSheet(id, "Sheet1")).toBe("taken");
    expect(state().renameSheet(id, "sheet1")).toBe("taken");
    expect(state().renameSheet(id, "Q1/Q2")).toBe("badChar");
    expect(state().renameSheet(id, "ก".repeat(32))).toBe("tooLong");
    expect(state().renameSheet(id, "'draft")).toBe("apostrophe");
    expect(state().renameSheet(id, "History")).toBe("reserved");
    expect(state().sheets.map((t) => t.name)).toEqual(["Sheet1", "Sheet2"]);
    expect(tabNamed("Sheet1").sheet.cells[0][0]).toBe("=Sheet2!A2");
    expect(shown("Sheet1", 0, 0)).toBe(7);
  });

  it("a rename that only changes a tab's own case is allowed, and its formulas follow", () => {
    state().addSheet();
    state().setActiveSheet(tabNamed("Sheet1").id);
    state().setCellRaw(0, 0, "=Sheet2!A1");
    expect(state().renameSheet(tabNamed("Sheet2").id, "SHEET2")).toBeNull();
    expect(tabNamed("Sheet1").sheet.cells[0][0]).toBe("=SHEET2!A1");
  });
});

describe("a workbook saved before the names were checked", () => {
  it("opens with valid names, formulas on the sheet they were written for, and exports", async () => {
    const sheet = (cells: [number, number, string][]) => {
      const s = createEmptySheet();
      for (const [r, c, v] of cells) s.cells[r][c] = v;
      return toStorage(s);
    };
    const saved = {
      sheets: [
        { id: "a", name: "Sheet1", sheet: sheet([[0, 0, "=Sheet3!A1"], [1, 0, "='Q1/Q2'!A1*2"], [2, 0, "=sheet1!A1"]]) },
        { id: "b", name: "Sheet3", sheet: sheet([[0, 0, "333"]]) },
        { id: "c", name: "Sheet3", sheet: sheet([[0, 0, "999"]]) },
        { id: "d", name: "Q1/Q2", sheet: sheet([[0, 0, "21"]]) },
        { id: "e", name: "sheet1", sheet: sheet([[0, 0, "5"]]) },
      ],
      activeSheetId: "a",
    };
    useSheetStore.setState(restoreSaved(saved, state()));
    expect(state().sheets.map((t) => t.name)).toEqual(["Sheet1", "Sheet3", "Sheet3 (2)", "Q1 Q2", "sheet1 (2)"]);
    expect(tabNamed("Sheet1").sheet.cells[1][0]).toBe("='Q1 Q2'!A1*2");
    expect([shown("Sheet1", 0, 0), shown("Sheet1", 1, 0)]).toEqual([333, 42]);

    await state().exportXlsx();
    expect(downloads).toHaveLength(1);
    const { names, xml } = await exported();
    expect(names).toEqual(["Sheet1", "Sheet3", "Sheet3 (2)", "Q1 Q2", "sheet1 (2)"]);
    const first = await xml(0);
    expect(cellXml(first, "A1")).toEqual({ f: "Sheet3!A1", v: "333" });
    expect(cellXml(first, "A2")).toEqual({ f: "'Q1 Q2'!A1*2", v: "42" });
  });
});

describe("the exported file carries real values (#101 item 1)", () => {
  it("a cross-sheet formula's cached <v> is its value, not 0", async () => {
    state().setCellRaw(0, 0, "1200");
    state().setCellRaw(1, 0, "=A1*2");
    state().addSheet();
    state().renameSheet(tabNamed("Sheet2").id, "สรุป");
    state().setCellRaw(0, 0, "=Sheet1!A1+Sheet1!A2");
    state().setCellRaw(1, 0, "=SUM(Sheet1!A1:A2)*0.07");
    await state().exportXlsx();
    const { names, xml } = await exported();
    expect(names).toEqual(["Sheet1", "สรุป"]);
    expect(cellXml(await xml(0), "A2")).toEqual({ f: "A1*2", v: "2400" });
    const summary = await xml(1);
    expect(cellXml(summary, "A1")).toEqual({ f: "Sheet1!A1+Sheet1!A2", v: "3600" });
    expect(Number(cellXml(summary, "A2").v)).toBeCloseTo(252, 9);
  });
});

describe("an export that fails says so (#54)", () => {
  it("shows an alert instead of a button that did nothing", async () => {
    const alert = vi.fn();
    vi.stubGlobal("alert", alert);
    vi.spyOn(console, "error").mockImplementation(() => {});
    failures.next = true;
    await expect(state().exportXlsx()).resolves.toBeUndefined();
    expect(downloads).toHaveLength(0);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toMatch(/Excel/);
    expect(state().busy).toBeNull();
  });
});
