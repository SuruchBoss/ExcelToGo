// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { dateLiteral, formatSerial, isDateFormatCode, isoFromSerial, partsOfSerial, serialOf } from "./excelDate";

/**
 * Dates as Excel keeps them (#45): a serial number of days, 1900 system, with the 29 February 1900
 * that Excel believes in (it copied Lotus 1-2-3's leap-year bug, and every file since depends on it).
 * Expected values are Excel's own: type the date into a cell and switch the format to General.
 */
describe("Excel serials", () => {
  it("matches Excel's numbers, including the day that never was", () => {
    expect(serialOf(1900, 1, 1)).toBe(1);
    expect(serialOf(1900, 2, 28)).toBe(59);
    expect(serialOf(1900, 2, 29)).toBe(60);
    expect(serialOf(1900, 3, 1)).toBe(61);
    expect(serialOf(2020, 1, 1)).toBe(43831); // the ERP's rule of thumb (#14)
    expect(serialOf(2024, 1, 15)).toBe(45306);
    expect(serialOf(9999, 12, 31)).toBe(2958465);
  });

  it("reads a serial back into the same date and time", () => {
    expect(partsOfSerial(45306)).toEqual({ year: 2024, month: 1, day: 15, hour: 0, minute: 0, second: 0 });
    expect(partsOfSerial(60)).toMatchObject({ year: 1900, month: 2, day: 29 });
    expect(partsOfSerial(61)).toMatchObject({ year: 1900, month: 3, day: 1 });
    expect(partsOfSerial(45306 + 14.5 / 24)).toMatchObject({ day: 15, hour: 14, minute: 30, second: 0 });
    // A time that is a hair under the next second, as floating point leaves it, is that second.
    expect(partsOfSerial(0.40625 - 1e-12)).toMatchObject({ hour: 9, minute: 45, second: 0 });
  });
});

describe("what a typed or pasted date means", () => {
  it("reads the ISO forms, and only those", () => {
    expect(dateLiteral("2024-01-15")).toEqual({ serial: 45306, kind: "date" });
    expect(dateLiteral("2024-01-15 14:30")).toEqual({ serial: 45306 + 14.5 / 24, kind: "datetime" });
    expect(dateLiteral("2024-01-15 14:30:15")?.kind).toBe("datetime");
    expect(dateLiteral("09:45")).toEqual({ serial: 0.40625, kind: "time" });
    expect(dateLiteral("09:45:30")?.kind).toBe("time");
    expect(dateLiteral("2024-1-5")?.serial).toBe(serialOf(2024, 1, 5));
  });

  it("leaves everything else as text — d/m and m/d are a guess this does not make", () => {
    for (const text of ["15/1/2024", "1/15/2024", "Jan 15", "2024-02-30", "2023-02-29", "1899-12-31", "24:00", "12:60", "2024-01-15T14:30", "45306", "2024"]) {
      expect(dateLiteral(text), text).toBeNull();
    }
    expect(dateLiteral("1900-02-29")?.serial).toBe(60);
  });
});

describe("showing a serial the way a format code says", () => {
  const t = 45306 + 14.5 / 24 + 15 / 86400; // 2024-01-15 14:30:15
  it("renders the codes Excel files carry", () => {
    expect(formatSerial(t, "yyyy-mm-dd")).toBe("2024-01-15");
    expect(formatSerial(t, "yyyy-mm-dd hh:mm")).toBe("2024-01-15 14:30");
    expect(formatSerial(t, "hh:mm:ss")).toBe("14:30:15");
    expect(formatSerial(t, "dd/mm/yyyy")).toBe("15/01/2024");
    expect(formatSerial(t, "d/m/yy")).toBe("15/1/24");
    expect(formatSerial(t, "mmm d, yyyy")).toBe("Jan 15, 2024");
    expect(formatSerial(t, "mmmm")).toBe("January");
    expect(formatSerial(t, "h:mm AM/PM")).toBe("2:30 PM");
    expect(formatSerial(t, "[$-409]d-mmm-yy;@")).toBe("15-Jan-24");
    expect(formatSerial(t, 'yyyy"年"m"月"')).toBe("2024年1月");
    expect(formatSerial(t, "dd\\.mm\\.yyyy")).toBe("15.01.2024");
  });

  it("tells a date code from a number code", () => {
    for (const code of ["yyyy-mm-dd", "dd/mm/yyyy", "mm-dd-yy", "h:mm", "[$-409]d-mmm-yy;@", "d mmmm yyyy"]) expect(isDateFormatCode(code), code).toBe(true);
    for (const code of ["General", "@", "0.00", "#,##0", '0.00"%"', '"฿"#,##0.00', '"days"0']) expect(isDateFormatCode(code), code).toBe(false);
  });

  it("writes a serial back as the ISO text the cell keeps", () => {
    expect(isoFromSerial(45306, "date")).toBe("2024-01-15");
    expect(isoFromSerial(t, "datetime")).toBe("2024-01-15 14:30:15");
    expect(isoFromSerial(45306 + 14.5 / 24, "datetime")).toBe("2024-01-15 14:30");
    expect(isoFromSerial(0.40625, "time")).toBe("09:45");
  });
});
