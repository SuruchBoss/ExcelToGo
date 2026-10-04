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

  // A timesheet's total in [h]:mm is hours elapsed, not the hour of the day it lands on (#219).
  it("counts elapsed time past a day in [h], [mm] and [ss]", () => {
    expect(formatSerial(1.5, "[h]:mm")).toBe("36:00");
    expect(formatSerial(3.75, "[h]:mm")).toBe("90:00");
    expect(formatSerial(2.25, "[h]:mm:ss")).toBe("54:00:00");
    expect(formatSerial(0.25, "[hh]:mm")).toBe("06:00");
    expect(formatSerial(0.1, "[mm]:ss")).toBe("144:00");
    expect(formatSerial(1 + 61 / 86_400, "[ss]")).toBe("86461");
    // The plain tokens still show the time of day.
    expect(formatSerial(1.5, "h:mm")).toBe("12:00");
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

/**
 * Buddhist-Era dates (#82). Thai files write 2569 for 2026, often with the month in Thai. Read
 * literally, every date is 543 years off, and DATEDIF, ages and overdue days are all wrong.
 */
describe("a Buddhist-Era date is the Gregorian date it means (#82)", () => {
  const jan15 = serialOf(2026, 1, 15);

  it("reads every form the issue lists as 15 January 2026", () => {
    for (const text of ["15/01/2569", "15-1-2569", "2569-01-15", "15 ม.ค. 2569", "15 มกราคม พ.ศ. 2569", "15 มค 2569", "15 ม.ค. 69", "15 มกราคม 2569", "15ม.ค.2569"]) {
      expect(dateLiteral(text), text).toEqual({ serial: jan15, kind: "date", era: "be" });
    }
    expect(dateLiteral("2569-01-15 13:45"), "with a time").toEqual({ serial: jan15 + (13 * 60 + 45) / 1440, kind: "datetime", era: "be" });
    expect(dateLiteral("15/01/2569 08:30")?.kind).toBe("datetime");
  });

  it("a two-digit year beside a Thai month is Buddhist; a four-digit one below 2400 is Gregorian", () => {
    expect(dateLiteral("15 พ.ค. 30")?.serial).toBe(serialOf(1987, 5, 15));
    expect(dateLiteral("15 ม.ค. 2026")).toEqual({ serial: jan15, kind: "date" });
    expect(dateLiteral("15 ม.ค. ค.ศ. 2026")?.serial).toBe(jan15);
  });

  it("knows all twelve months, full and short, with and without the dots", () => {
    const full = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const short = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    for (let m = 1; m <= 12; m++) {
      const want = serialOf(2026, m, 1);
      expect(dateLiteral(`1 ${full[m - 1]} 2569`)?.serial, full[m - 1]).toBe(want);
      expect(dateLiteral(`1 ${short[m - 1]} 2569`)?.serial, short[m - 1]).toBe(want);
      expect(dateLiteral(`1 ${short[m - 1].replace(/\./g, "")} 2569`)?.serial, short[m - 1]).toBe(want);
    }
  });

  it("guesses nothing: 2569 alone, 15/01/69, a Gregorian d/m/yyyy and a date that does not exist stay text", () => {
    for (const text of ["2569", "15/01/69", "15/01/2024", "01/15/2026", "31/02/2569", "15 ม.ค.", "ม.ค. 2569", "15 มกรา 2569", "15/01/2800"]) {
      expect(dateLiteral(text), text).toBeNull();
    }
  });
});

describe("a Buddhist-Era format shows the year Thai Excel does (#82)", () => {
  const jan15 = serialOf(2026, 1, 15);

  it("the Thai calendar's locale tag, as a number or by name, shows the year 543 higher", () => {
    expect(formatSerial(jan15, "[$-107041E]d/m/yyyy;@")).toBe("15/1/2569");
    expect(formatSerial(jan15, "[$-1070000]dd/mm/yyyy")).toBe("15/01/2569");
    expect(formatSerial(jan15, "[$-D07041E]d/mm/yy")).toBe("15/01/69");
    expect(formatSerial(jan15, "[$-th-TH,107]d/m/yyyy")).toBe("15/1/2569");
  });

  it("bbbb is the Buddhist year in any code", () => {
    expect(formatSerial(jan15, "dd/mm/bbbb")).toBe("15/01/2569");
    expect(formatSerial(jan15, "d/m/bb")).toBe("15/1/69");
  });

  it("a Thai locale shows Thai month and day names; a Gregorian Thai one keeps the year", () => {
    expect(formatSerial(jan15, "[$-107041E]d mmmm yyyy")).toBe("15 มกราคม 2569");
    expect(formatSerial(jan15, "[$-107041E]d mmm yy")).toBe("15 ม.ค. 69");
    expect(formatSerial(jan15, "[$-41E]dddd d mmm yyyy")).toBe("พฤหัสบดี 15 ม.ค. 2026");
  });

  it("other locale tags change nothing", () => {
    expect(formatSerial(jan15, "[$-409]d-mmm-yyyy")).toBe("15-Jan-2026");
    expect(formatSerial(jan15, "[$-F800]dddd, mmmm dd, yyyy")).toBe("Thursday, January 15, 2026");
  });

  it("the Buddhist codes count as date codes", () => {
    for (const code of ["[$-107041E]d/m/yyyy;@", "dd/mm/bbbb", "[$-th-TH,107]d/m/yyyy"]) expect(isDateFormatCode(code), code).toBe(true);
  });
});
