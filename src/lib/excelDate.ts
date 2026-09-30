// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Dates the way Excel keeps them (#45).
 *
 * A date is a number: whole days since the start of 1900, with the time of day as the fraction.
 * `2020-01-01` is 43831 and noon is .5 — which is why `=A2-A1` is a count of days and `=A1+30` is a
 * date a month on, and why a file that stores them any other way stops being a spreadsheet the
 * moment it is opened elsewhere.
 *
 * The 1900 system, including 29 February 1900: a day that did not happen, which Excel inherited from
 * Lotus 1-2-3 so its files would read the same, and which every workbook since has depended on.
 * Serial 60 is that day; everything before it is one lower than a true day count, everything after
 * it is not. Matching it exactly is what makes a date typed here the same number in Excel.
 *
 * This module is the only place the arithmetic lives. The cell rule (`cellLiteral.ts`), the date
 * functions, the grid's display and the `.xlsx` reader and writer all go through it.
 */

export type DateKind = "date" | "datetime" | "time";

const DAY_MS = 86_400_000;
const EPOCH = Date.UTC(1899, 11, 30);
const EPOCH_EARLY = Date.UTC(1899, 11, 31);

/** The serial of a calendar date (no time). */
export function serialOf(year: number, month: number, day: number): number {
  if (year === 1900 && month === 2 && day === 29) return 60;
  const days = Math.round((Date.UTC(year, month - 1, day) - EPOCH) / DAY_MS);
  // Before 1 March 1900 Excel counts from one day later, because of the day above.
  return days < 61 ? days - 1 : days;
}

export interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** A serial as calendar parts, to the nearest second — the resolution Excel shows. */
export function partsOfSerial(serial: number): DateParts {
  const totalSeconds = Math.round(serial * 86_400);
  const whole = Math.floor(totalSeconds / 86_400);
  let rest = totalSeconds - whole * 86_400;
  const hour = Math.floor(rest / 3600);
  rest -= hour * 3600;
  const minute = Math.floor(rest / 60);
  const second = rest - minute * 60;
  if (whole === 60) return { year: 1900, month: 2, day: 29, hour, minute, second };
  const d = new Date((whole < 60 ? EPOCH_EARLY : EPOCH) + whole * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour, minute, second };
}

function validDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  if (year === 1900 && month === 2 && day === 29) return true;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const TIME = String.raw`(?: (\d{1,2}):(\d{2})(?::(\d{2}))?)?`;
const ISO_DATE = new RegExp(String.raw`^(\d{4})-(\d{1,2})-(\d{1,2})${TIME}$`);
const ISO_TIME = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
/** `15/01/2569`, `15-1-2569`: day first, the way every Thai writes it — read only with a BE year. */
const DMY = new RegExp(String.raw`^(\d{1,2})([/-])(\d{1,2})\2(\d{4})${TIME}$`);

/**
 * The Thai month names, full and short (#82). The short forms are matched with or without their
 * dots — `ม.ค.`, `มค` — because both are how people type them.
 */
export const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const THAI_DAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

const dotsOptional = (short: string) => short.replace(/\./g, "").split("").join(String.raw`\.?`) + String.raw`\.?`;
// Full names first: `มีนาคม` must not stop at a short form that happens to match its start.
const MONTH_ALTERNATIVES = [...THAI_MONTHS, ...THAI_MONTHS_SHORT.map(dotsOptional)].join("|");
const THAI_DATE = new RegExp(String.raw`^(\d{1,2})\s*(${MONTH_ALTERNATIVES})\s*(?:(พ\.?ศ\.?|ค\.?ศ\.?)\s*)?(\d{4}|\d{2})${TIME}$`);

function thaiMonth(name: string): number {
  const full = THAI_MONTHS.indexOf(name);
  if (full !== -1) return full + 1;
  const bare = name.replace(/\./g, "");
  return THAI_MONTHS_SHORT.findIndex((m) => m.replace(/\./g, "") === bare) + 1;
}

/** The difference between the Thai Buddhist Era and the Gregorian year. */
export const BE_OFFSET = 543;
/** A four-digit year in this range, in text that looks like a date, is a Buddhist-Era year (#82). */
const isBeYear = (year: number) => year >= 2400 && year <= 2700;

function timeFraction(h: string, m: string, s: string | undefined): number | null {
  const hour = Number(h);
  const minute = Number(m);
  const second = Number(s ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return (hour * 3600 + minute * 60 + second) / 86_400;
}

/** `era: "be"` when the text gave its year in the Buddhist Era: the value is still the Gregorian date. */
export interface DateLiteral {
  serial: number;
  kind: DateKind;
  era?: "be";
}

function dateOf(year: number, month: number, day: number, h: string | undefined, mi: string | undefined, s: string | undefined, era?: "be"): DateLiteral | null {
  if (year < 1900 || year > 9999 || !validDay(year, month, day)) return null;
  const serial = serialOf(year, month, day);
  const withEra = (d: DateLiteral): DateLiteral => (era ? { ...d, era } : d);
  if (h === undefined) return withEra({ serial, kind: "date" });
  const fraction = timeFraction(h, mi!, s);
  return fraction === null ? null : withEra({ serial: serial + fraction, kind: "datetime" });
}

/**
 * The date a piece of text means, or null for text that is not one.
 *
 * The ISO forms — `2024-01-15`, `2024-01-15 13:45`, `2024-01-15 13:45:30`, `13:45` — because they
 * are the only numeric ones that cannot be misread: `03/04/2024` is March in one country and April
 * in another, and a guess that is wrong moves a date a month without a word.
 *
 * And the Thai forms that cannot be misread either (#82):
 * - **A four-digit year from 2400 to 2700 is the Buddhist Era**, in `d/m/yyyy`, `d-m-yyyy` or ISO
 *   (`15/01/2569`, `2569-01-15`): no Gregorian date in a sheet is five centuries away, and a Thai who
 *   writes the year that way writes the day first. The value is the Gregorian date, 543 years back.
 * - **A Thai month name** (`15 ม.ค. 2569`, `15 มกราคม พ.ศ. 2569`, `15 มค 69`) says Thai, so a two-digit
 *   year is a Buddhist one (`69` is 2569) — nearly everyone who writes the month in Thai counts the
 *   years that way. A four-digit year from 1900 to 2399 with it is Gregorian (`15 ม.ค. 2026`).
 *
 * Everything else stays the text it is: `2569` alone, `15/01/69` (a birthday in 2530 or a due date
 * in 2030 — the "Convert to dates" command asks), `15/01/2024` (day or month first). One function, so
 * the cell, the formulas, the importers and the fill handle all read the same dates.
 */
export function dateLiteral(text: string): DateLiteral | null {
  const iso = ISO_DATE.exec(text);
  if (iso) {
    const [, y, mo, d, h, mi, s] = iso;
    const year = Number(y);
    return isBeYear(year) ? dateOf(year - BE_OFFSET, Number(mo), Number(d), h, mi, s, "be") : dateOf(year, Number(mo), Number(d), h, mi, s);
  }
  const dmy = DMY.exec(text);
  if (dmy) {
    const [, d, , mo, y, h, mi, s] = dmy;
    const year = Number(y);
    return isBeYear(year) ? dateOf(year - BE_OFFSET, Number(mo), Number(d), h, mi, s, "be") : null;
  }
  const thai = THAI_DATE.exec(text);
  if (thai) {
    const [, d, name, marker, y, h, mi, s] = thai;
    const month = thaiMonth(name);
    const saysCe = marker !== undefined && marker.startsWith("ค");
    const saysBe = marker !== undefined && !saysCe;
    let year = Number(y);
    if (y.length === 2) {
      if (saysCe) return null;
      year += 2500;
    }
    if (saysCe) return dateOf(year, month, Number(d), h, mi, s);
    if (saysBe || isBeYear(year)) return dateOf(year - BE_OFFSET, month, Number(d), h, mi, s, "be");
    return year < 2400 ? dateOf(year, month, Number(d), h, mi, s) : null;
  }
  const time = ISO_TIME.exec(text);
  if (time) {
    const fraction = timeFraction(time[1], time[2], time[3]);
    return fraction === null ? null : { serial: fraction, kind: "time" };
  }
  return null;
}

const two = (n: number) => String(n).padStart(2, "0");

/** A serial as the ISO text a cell keeps: what `dateLiteral` reads back to the same number. */
export function isoFromSerial(serial: number, kind: DateKind): string {
  const p = partsOfSerial(serial);
  const date = `${p.year}-${two(p.month)}-${two(p.day)}`;
  const time = `${two(p.hour)}:${two(p.minute)}${p.second ? `:${two(p.second)}` : ""}`;
  return kind === "date" ? date : kind === "time" ? time : `${date} ${time}`;
}

/** The format each kind is shown in when the cell names none: ISO, in the Gregorian year. */
export const DEFAULT_DATE_CODE: Record<DateKind, string> = {
  date: "yyyy-mm-dd",
  datetime: "yyyy-mm-dd hh:mm",
  time: "hh:mm",
};

/**
 * The Buddhist-Era date as Thai Excel writes it (#82): day/month/year, the year in the Thai
 * calendar (`07` in the locale tag), Thai (`041E`). Used for the "Date (B.E.)" format and for a date
 * typed with a Buddhist year, so Excel opens it showing 2569 as the grid does.
 *
 * NOT YET CHECKED against a file Excel itself saved — the issue asks for exactly that, and no such
 * file could be reached from here. Reading does not depend on it: every Thai-calendar tag and
 * `bbbb` show a Buddhist year on the way in. Only this one code, going out, waits on that file.
 */
export const BE_DATE_CODE: Record<"date" | "datetime", string> = {
  date: "[$-107041E]d/m/yyyy;@",
  datetime: "[$-107041E]d/m/yyyy h:mm;@",
};

/** Codes with their literal parts and bracketed modifiers taken out, so only the tokens remain. */
function bareCode(code: string): string {
  return code
    .split(";")[0]
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/\[(?![hms]+\])[^\]]*\]/gi, "");
}

/** Whether an Excel number-format code shows a date or a time rather than a number. */
export function isDateFormatCode(code: string | undefined): boolean {
  if (!code || code === "General" || code === "@") return false;
  return /[ymdhsb]/i.test(bareCode(code).replace(/General/gi, ""));
}

/** Which kind a date format code is, for the app's own three formats. */
export function kindOfDateCode(code: string): DateKind {
  const bare = bareCode(code).toLowerCase();
  const hasDate = /[ydb]/.test(bare) || /m{3,}/.test(bare) || (/m/.test(bare) && !/[hs]/.test(bare));
  const hasTime = /[hs]/.test(bare);
  return hasDate && hasTime ? "datetime" : hasTime ? "time" : "date";
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Token = { kind: "lit"; text: string } | { kind: "tok"; text: string };

/** What a code's locale tag says about how a date is written: the calendar and the language. */
interface DateLocale {
  /** The Thai Buddhist calendar: every year shows 543 higher (#82). */
  be: boolean;
  /** Thai month and weekday names. */
  thai: boolean;
}

/**
 * Reads a `[$-…]` tag. Excel writes the locale as a number — `[$-107041E]`: `041E` is Thai, the `07`
 * before it the Thai Buddhist calendar, the rest the digits it uses — or, lately, by name with the
 * same number after a comma, `[$-th-TH,107]`. Anything else — `[$-409]`, `[$€-407]` — says nothing
 * that changes a date.
 */
export function dateLocaleOf(inner: string): DateLocale {
  const tag = /^\$[^-]*-(.+)$/.exec(inner)?.[1];
  if (!tag) return { be: false, thai: false };
  if (/^[0-9a-f]+$/i.test(tag)) {
    const value = parseInt(tag, 16);
    return { be: ((value >>> 16) & 0xff) === 7, thai: (value & 0xffff) === 0x041e };
  }
  const [name, extra] = tag.split(",");
  return { be: extra !== undefined && (parseInt(extra, 16) & 0xff) === 7, thai: /^th(-|$)/i.test(name) };
}

function tokenizeWithLocale(code: string): { tokens: Token[]; locale: DateLocale } {
  const section = code.split(";")[0];
  const out: Token[] = [];
  const locale: DateLocale = { be: false, thai: false };
  let i = 0;
  while (i < section.length) {
    const ch = section[i];
    if (ch === '"') {
      const end = section.indexOf('"', i + 1);
      out.push({ kind: "lit", text: section.slice(i + 1, end === -1 ? undefined : end) });
      i = end === -1 ? section.length : end + 1;
    } else if (ch === "\\") {
      out.push({ kind: "lit", text: section[i + 1] ?? "" });
      i += 2;
    } else if (ch === "[") {
      const end = section.indexOf("]", i);
      const inner = section.slice(i + 1, end === -1 ? undefined : end);
      // Elapsed-time brackets ([h], [mm]) read as their plain token; a locale tag may set the calendar
      // and the language (#82); colour tags do nothing.
      if (/^[hms]+$/i.test(inner)) out.push({ kind: "tok", text: inner.toLowerCase() });
      else if (inner.startsWith("$")) {
        const tag = dateLocaleOf(inner);
        locale.be ||= tag.be;
        locale.thai ||= tag.thai;
      }
      i = end === -1 ? section.length : end + 1;
    } else if (/^(AM\/PM|am\/pm|A\/P|a\/p)/.test(section.slice(i))) {
      const m = /^(AM\/PM|am\/pm|A\/P|a\/p)/.exec(section.slice(i))![0];
      out.push({ kind: "tok", text: m.toUpperCase() });
      i += m.length;
    } else if (/[ymdhsb]/i.test(ch)) {
      let j = i;
      while (j < section.length && section[j].toLowerCase() === ch.toLowerCase()) j++;
      out.push({ kind: "tok", text: section.slice(i, j).toLowerCase() });
      i = j;
    } else if (ch === "@" || ch === "_" || ch === "*") {
      i += ch === "@" ? 1 : 2;
    } else {
      out.push({ kind: "lit", text: ch });
      i++;
    }
  }
  return { tokens: out, locale };
}

/**
 * A serial shown the way an Excel format code says: `dd/mm/yyyy`, `d-mmm-yy`, `h:mm AM/PM`.
 *
 * The part of Excel's format language that dates use, which is what files carry: year, month, day,
 * weekday, hour, minute, second, AM/PM, quoted and escaped literals. `m` is a month unless it sits
 * after an hour or before a second, as in Excel. A locale tag for the Thai Buddhist calendar shows
 * the year 543 higher, and one for Thai shows Thai month and day names; `bb`/`bbbb` are the Buddhist
 * year in any code (#82). Other locale tags (`[$-409]`) are read past.
 */
export function formatSerial(serial: number, code: string): string {
  const p = partsOfSerial(serial);
  const { tokens, locale } = tokenizeWithLocale(code);
  const months = locale.thai ? THAI_MONTHS : MONTHS;
  const shortMonth = (m: number) => (locale.thai ? THAI_MONTHS_SHORT[m - 1] : MONTHS[m - 1].slice(0, 3));
  const beYear = p.year + BE_OFFSET;
  const twelve = tokens.some((t) => t.kind === "tok" && (t.text === "AM/PM" || t.text === "A/P"));
  const isMinute = (index: number): boolean => {
    for (let k = index - 1; k >= 0; k--) {
      const t = tokens[k];
      if (t.kind === "tok") return t.text.startsWith("h");
    }
    for (let k = index + 1; k < tokens.length; k++) {
      const t = tokens[k];
      if (t.kind === "tok") return t.text.startsWith("s");
    }
    return false;
  };
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return tokens
    .map((t, index) => {
      if (t.kind === "lit") return t.text;
      const s = t.text;
      switch (s[0]) {
        case "y": {
          const year = locale.be ? beYear : p.year;
          return s.length <= 2 ? two(year % 100) : String(year);
        }
        case "b":
          return s.length <= 2 ? two(beYear % 100) : String(beYear);
        case "m":
          if (s.length <= 2 && isMinute(index)) return s.length === 2 ? two(p.minute) : String(p.minute);
          if (s.length === 1) return String(p.month);
          if (s.length === 2) return two(p.month);
          if (s.length === 3) return shortMonth(p.month);
          if (s.length === 5) return months[p.month - 1][0];
          return months[p.month - 1];
        case "d":
          if (s.length === 1) return String(p.day);
          if (s.length === 2) return two(p.day);
          if (s.length === 3) return locale.thai ? THAI_DAYS_SHORT[weekday] : DAYS[weekday].slice(0, 3);
          return (locale.thai ? THAI_DAYS : DAYS)[weekday];
        case "h": {
          const h = twelve ? hour12 : p.hour;
          return s.length >= 2 ? two(h) : String(h);
        }
        case "s":
          return s.length >= 2 ? two(p.second) : String(p.second);
        case "A":
          return s === "A/P" ? (p.hour < 12 ? "A" : "P") : p.hour < 12 ? "AM" : "PM";
        default:
          return s;
      }
    })
    .join("");
}
