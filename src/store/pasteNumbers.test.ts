// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { computeTab, useSheetStore } from "./sheetStore";

/**
 * A column pasted from Excel or Google Sheets (#52): the clipboard holds what the screen showed —
 * `1,250`, `15%`, `฿1,234.50` — as tab-separated text, and the paste path is what turns it into cells.
 */
const state = () => useSheetStore.getState();
const sheet = () => state().sheets.find((t) => t.id === state().activeSheetId)!.sheet;
const at = (row: number, col: number) => state().setSelection({ startRow: row, startCol: col, endRow: row, endCol: col, anchorRow: row, anchorCol: col });

beforeEach(() => state().startBlank());

describe("pasting numbers as Excel copies them (#52)", () => {
  it("adds up to Excel's total, and codes pasted beside them stay codes", () => {
    at(0, 3);
    state().pasteAtSelection("Amount\tCode\r\n1,250\t00123\r\n2,000\t0812345678\r\n15%\t081-234-5678\r\n฿1,234.50\t1,25\r\n");
    state().setCellRaw(5, 3, "=SUM(D2:D5)");
    const c = computeTab(sheet(), state().sheets);
    expect(c.values[5][3]).toBeCloseTo(4484.65, 10);
    expect(c.display.slice(1, 5).map((r) => r[3])).toEqual(["1,250", "2,000", "15%", "฿1,234.50"]);
    expect(c.values.slice(1, 5).map((r) => r[4])).toEqual(["00123", "0812345678", "081-234-5678", "1,25"]);
  });
});
