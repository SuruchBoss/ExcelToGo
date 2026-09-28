// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { serialOf } from "@/lib/excelDate";
import { computeTab, useSheetStore } from "./sheetStore";

/**
 * "Convert to dates" and "Date (B.E.)" through the store (#82): what a person gets from the dialog
 * and the format list.
 */
const state = () => useSheetStore.getState();
const sheet = () => state().sheets.find((t) => t.id === state().activeSheetId)!.sheet;
const computed = () => computeTab(sheet(), state().sheets);
const select = (startRow: number, startCol: number, endRow: number, endCol: number) =>
  state().setSelection({ startRow, startCol, endRow, endCol, anchorRow: startRow, anchorCol: startCol });

beforeEach(() => {
  state().startBlank();
  useSheetStore.temporal.getState().clear();
});

describe("Convert to dates (#82)", () => {
  function typeColumn(values: string[]) {
    values.forEach((v, r) => state().setCellRaw(r, 0, v));
    select(0, 0, values.length - 1, 0);
  }

  it("rewrites what it can read as ISO, shows it in the Buddhist year, and leaves the rest", () => {
    typeColumn(["15/01/69", "15/05/30", "not a date", "=1+1"]);
    state().convertSelectionToDates("dmy", "be");
    expect(sheet().cells.slice(0, 4).map((r) => r[0])).toEqual(["2026-01-15", "1987-05-15", "not a date", "=1+1"]);
    expect(computed().values[0][0]).toBe(serialOf(2026, 1, 15));
    expect(computed().display[0][0]).toBe("15/1/2569");
    expect(computed().display[1][0]).toBe("15/5/2530");
    expect(state().announcement?.text).toMatch(/2/);
  });

  it("in the Gregorian calendar, month first, keeps the app's own date layout", () => {
    typeColumn(["01/15/26", "15/05/30"]);
    state().convertSelectionToDates("mdy", "ce");
    expect(sheet().cells[0][0]).toBe("2026-01-15");
    expect(computed().display[0][0]).toBe("2026-01-15");
    // Month 15 does not exist: left alone.
    expect(sheet().cells[1][0]).toBe("15/05/30");
  });

  it("one undo puts every cell and its format back", () => {
    typeColumn(["15/01/69", "16/01/69"]);
    const before = sheet();
    state().convertSelectionToDates("dmy", "be");
    expect(sheet().cells[1][0]).toBe("2026-01-16");
    useSheetStore.temporal.getState().undo();
    expect(sheet().cells.slice(0, 2).map((r) => r[0])).toEqual(["15/01/69", "16/01/69"]);
    expect(sheet().formats[0][0]?.numberFormat).toBe(before.formats[0][0]?.numberFormat);
  });

  it("a format somebody chose stays", () => {
    typeColumn(["15/01/69"]);
    state().setNumberFormat("datetime");
    state().convertSelectionToDates("dmy", "be");
    expect(sheet().formats[0][0]?.numberFormat).toBe("datetime");
    expect(computed().display[0][0]).toBe("2026-01-15 00:00");
  });
});

describe("the Date (B.E.) format (#82)", () => {
  it("shows a date in the Buddhist year and the list shows it as picked", () => {
    state().setCellRaw(0, 0, "2026-01-15");
    select(0, 0, 0, 0);
    state().setNumberFormat("dateBE");
    expect(computed().display[0][0]).toBe("15/1/2569");
    expect(computed().values[0][0]).toBe(serialOf(2026, 1, 15));
    state().setNumberFormat("date");
    expect(computed().display[0][0]).toBe("2026-01-15");
  });
});
