// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { DATETIME_COL_WIDTH, withRoomForDateTime } from "@/lib/dateCells";
import { createEmptySheet, setCellRaw, setRangeFormat } from "@/lib/sheet";
import { computeTab, useSheetStore } from "./sheetStore";

/**
 * Entering a date the way a person does (#45, decision 8): a formula that makes one shows as one,
 * a date and time gets the room it needs, and a format somebody chose is left alone.
 */
const state = () => useSheetStore.getState();
const sheet = () => state().sheets.find((t) => t.id === state().activeSheetId)!.sheet;
const shown = (r: number, c: number) => computeTab(sheet(), state().sheets).display[r][c];
const at = (r: number, c: number) => state().setSelection({ startRow: r, startCol: c, endRow: r, endCol: c, anchorRow: r, anchorCol: c });

beforeEach(() => state().startBlank());

describe("a date formula shows as a date", () => {
  it("formats =TODAY() and =DATE() as dates and =NOW() as a date and time", () => {
    state().setCellRaw(0, 0, "=DATE(2024,1,15)");
    state().setCellRaw(1, 0, "=TODAY()");
    state().setCellRaw(2, 0, "=now()");
    expect(sheet().formats[0][0]?.numberFormat).toBe("date");
    expect(shown(0, 0)).toBe("2024-01-15");
    expect(shown(1, 0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sheet().formats[2][0]?.numberFormat).toBe("datetime");
    expect(shown(2, 0)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("leaves a cell somebody formatted alone, and other formulas unformatted", () => {
    at(0, 0);
    state().setNumberFormat("number2");
    state().setCellRaw(0, 0, "=DATE(2024,1,15)");
    expect(shown(0, 0)).toBe("45,306.00");
    state().setCellRaw(1, 0, "=SUM(1,2)");
    expect(sheet().formats[1][0]?.numberFormat).toBeUndefined();
  });

  it("formats a date formula the AI assistant or the palette puts in", () => {
    at(3, 1);
    state().insertAIFormula("TODAY()");
    expect(sheet().formats[3][1]?.numberFormat).toBe("date");
  });
});

describe("a date and time gets room to show", () => {
  it("widens a column at the default width, not one somebody sized", () => {
    state().setCellRaw(0, 2, "2024-01-15 14:30");
    expect(sheet().colWidths?.[2]).toBe(DATETIME_COL_WIDTH);
    state().setCellRaw(0, 3, "2024-01-15");
    expect(sheet().colWidths?.[3]).toBeUndefined();
    const sized = { ...createEmptySheet(), colWidths: [60] };
    expect(withRoomForDateTime(sized, "2024-01-15 14:30", 0)).toBe(sized);
    expect(withRoomForDateTime(sized, "=NOW()", 1).colWidths?.[1]).toBe(DATETIME_COL_WIDTH);
  });
});

describe("picking a date format from the bar", () => {
  it("replaces a layout the file brought in with the app's own", () => {
    const fromFile = setCellRaw(setRangeFormat(createEmptySheet(), 0, 0, 0, 0, { numberFormat: "date", dateFormat: "dd/mm/yyyy" }), 0, 0, "2026-10-02");
    state().replaceWorkbook([{ id: "imported", name: "Imported", sheet: fromFile }]);
    expect(shown(0, 0)).toBe("02/10/2026");
    at(0, 0);
    state().setNumberFormat("date");
    expect(shown(0, 0)).toBe("2026-10-02");
    state().setNumberFormat("datetime");
    expect(shown(0, 0)).toBe("2026-10-02 00:00");
  });
});
