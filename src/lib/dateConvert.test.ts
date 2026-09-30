// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { convertDate, planConversion } from "./dateConvert";

/**
 * "Convert to dates" (#82): the dates that cannot be read without being told how. Every case from the
 * issue, and the ones that must be left alone.
 */
describe("converting text to dates, as told (#82)", () => {
  const iso = (raw: string, order: "dmy" | "mdy" | "ymd", calendar: "be" | "ce") => convertDate(raw, order, calendar)?.iso ?? null;

  it("a two-digit year in the Buddhist Era is 25yy", () => {
    expect(iso("15/01/69", "dmy", "be")).toBe("2026-01-15");
    expect(iso("15/05/30", "dmy", "be")).toBe("1987-05-15");
  });

  it("in the Gregorian calendar, two digits follow Excel's window: 00–29 is 20yy, 30–99 is 19yy", () => {
    expect(iso("15/05/30", "dmy", "ce")).toBe("1930-05-15");
    expect(iso("15/05/29", "dmy", "ce")).toBe("2029-05-15");
    expect(iso("01/15/26", "mdy", "ce")).toBe("2026-01-15");
  });

  it("takes a Gregorian d/m/yyyy, which is never read automatically, and years first", () => {
    expect(iso("15/01/2024", "dmy", "ce")).toBe("2024-01-15");
    expect(iso("03/04/2026", "mdy", "ce")).toBe("2026-03-04");
    expect(iso("2569/01/15", "ymd", "be")).toBe("2026-01-15");
    expect(iso("15.01.2569", "dmy", "be")).toBe("2026-01-15");
    expect(iso("15/01/2569 08:30", "dmy", "be")).toBe("2026-01-15 08:30");
  });

  it("what already reads as a date needs no choice, and is written as ISO", () => {
    expect(iso("15 ม.ค. 69", "mdy", "ce")).toBe("2026-01-15");
    expect(iso("'2024-01-15", "dmy", "be")).toBe("2024-01-15");
  });

  it("leaves what is not a date this way alone", () => {
    for (const raw of ["", "=A1", "hello", "32/01/69", "15/13/69", "15/01/1", "12:30", "15/01/2569/1", "123"]) {
      expect(convertDate(raw, "dmy", "be"), raw).toBeNull();
    }
    // 2400 in the Gregorian calendar is still a year; less 543 in the Buddhist Era, 1857 is before any serial.
    expect(iso("15/01/2400", "dmy", "be")).toBeNull();
  });

  it("plans a range: what changes, what cannot, and nothing about empty cells or formulas", () => {
    const grid = [["15/01/69", "", "=A1+1"], ["hello", "2026-01-15", "01/02/03"]];
    const plan = planConversion((r, c) => grid[r][c], { startRow: 0, endRow: 1, startCol: 0, endCol: 2 }, "dmy", "be");
    expect(plan.changes.map((ch) => [ch.before, ch.after.iso])).toEqual([["15/01/69", "2026-01-15"], ["01/02/03", "1960-02-01"]]);
    expect(plan.unreadable.map((u) => u.before)).toEqual(["hello"]);
  });
});
