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

const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?: (\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const ISO_TIME = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

function timeFraction(h: string, m: string, s: string | undefined): number | null {
  const hour = Number(h);
  const minute = Number(m);
  const second = Number(s ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return (hour * 3600 + minute * 60 + second) / 86_400;
}

/**
 * The date a piece of text means, or null for text that is not one.
 *
 * Only the ISO forms — `2024-01-15`, `2024-01-15 13:45`, `2024-01-15 13:45:30`, `13:45` — because
 * they are the only ones that cannot be misread: `03/04/2024` is March in one country and April in
 * another, and a guess that is wrong moves a date a month without a word. Everything else stays the
 * text it is. One function so that #82 (Buddhist-era years, Thai month names) adds forms here and
 * nowhere else.
 */
export function dateLiteral(text: string): { serial: number; kind: DateKind } | null {
  const date = ISO_DATE.exec(text);
  if (date) {
    const [, y, mo, d, h, mi, s] = date;
    const year = Number(y);
    if (year < 1900 || !validDay(year, Number(mo), Number(d))) return null;
    const serial = serialOf(year, Number(mo), Number(d));
    if (h === undefined) return { serial, kind: "date" };
    const fraction = timeFraction(h, mi, s);
    return fraction === null ? null : { serial: serial + fraction, kind: "datetime" };
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
  return /[ymdhs]/i.test(bareCode(code).replace(/General/gi, ""));
}

/** Which kind a date format code is, for the app's own three formats. */
export function kindOfDateCode(code: string): DateKind {
  const bare = bareCode(code).toLowerCase();
  const hasDate = /[yd]/.test(bare) || /m{3,}/.test(bare) || (/m/.test(bare) && !/[hs]/.test(bare));
  const hasTime = /[hs]/.test(bare);
  return hasDate && hasTime ? "datetime" : hasTime ? "time" : "date";
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Token = { kind: "lit"; text: string } | { kind: "tok"; text: string };

function tokenize(code: string): Token[] {
  const section = code.split(";")[0];
  const out: Token[] = [];
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
      // Elapsed-time brackets ([h], [mm]) read as their plain token; locale and colour tags do nothing.
      if (/^[hms]+$/i.test(inner)) out.push({ kind: "tok", text: inner.toLowerCase() });
      i = end === -1 ? section.length : end + 1;
    } else if (/^(AM\/PM|am\/pm|A\/P|a\/p)/.test(section.slice(i))) {
      const m = /^(AM\/PM|am\/pm|A\/P|a\/p)/.exec(section.slice(i))![0];
      out.push({ kind: "tok", text: m.toUpperCase() });
      i += m.length;
    } else if (/[ymdhs]/i.test(ch)) {
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
  return out;
}

/**
 * A serial shown the way an Excel format code says: `dd/mm/yyyy`, `d-mmm-yy`, `h:mm AM/PM`.
 *
 * The part of Excel's format language that dates use, which is what files carry: year, month, day,
 * weekday, hour, minute, second, AM/PM, quoted and escaped literals. `m` is a month unless it sits
 * after an hour or before a second, as in Excel. Locale tags (`[$-409]`) are read past; a Thai
 * calendar code is #82's.
 */
export function formatSerial(serial: number, code: string): string {
  const p = partsOfSerial(serial);
  const tokens = tokenize(code);
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
        case "y":
          return s.length <= 2 ? two(p.year % 100) : String(p.year);
        case "m":
          if (s.length <= 2 && isMinute(index)) return s.length === 2 ? two(p.minute) : String(p.minute);
          if (s.length === 1) return String(p.month);
          if (s.length === 2) return two(p.month);
          if (s.length === 3) return MONTHS[p.month - 1].slice(0, 3);
          if (s.length === 5) return MONTHS[p.month - 1][0];
          return MONTHS[p.month - 1];
        case "d":
          if (s.length === 1) return String(p.day);
          if (s.length === 2) return two(p.day);
          if (s.length === 3) return DAYS[weekday].slice(0, 3);
          return DAYS[weekday];
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
