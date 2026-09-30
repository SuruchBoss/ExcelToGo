// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { NumberFormat } from "./cellFormat";
import { dateLiteral } from "./excelDate";
import type { FormulaValue } from "./formulaEngine/types";

/**
 * What a non-formula cell holds: a number when it reads as one, its text otherwise.
 *
 * The one place that decides it. The engine, the .xlsx writer and the landing page's demo sheet
 * each used to carry their own `Number(raw)`, which is how a phone number lost its leading zero on
 * the grid, in the export, in the CSV, in sort order and in every chart at once (#23) — and how a
 * fix to one of the copies would have left the file disagreeing with the screen.
 *
 * In order:
 *
 * 1. **A leading apostrophe** means "the rest is text", as in Excel. The apostrophe stays in the
 *    cell, so the formula bar shows it and the grid does not.
 * 2. **A cell formatted as text** (Excel's `@`) keeps whatever was typed, digits and all. It is the
 *    marker for a whole column of codes, where an apostrophe on every cell would be a chore.
 * 3. **An integer with a leading zero** (`0812345678`, `00123`) is text. Nobody means `00123` as
 *    the number 123; they mean a code. `0` and `0.5` are still numbers.
 * 4. **Twelve digits or more, nothing else** (`1234567890123`) is text. Past that length it is an
 *    ID card, an account or a barcode, not an amount, and Excel's own answer — show it as
 *    1.23457E+12 and round off the tail past fifteen digits — destroys it.
 * 5. **An ISO date or time** (`2024-01-15`, `2024-01-15 13:45`, `13:45`) is that date's Excel serial,
 *    so `=A1+1` is the next day and the file gets a real date (#45). The text stays in the cell;
 *    only its value is a number. Other layouts stay text — see `excelDate.dateLiteral` for why.
 * 6. **A number written the way a screen shows it** (#52) — `1,250`, `12%`, `฿1,500.00`, `-$3.50` — is
 *    that number: commas only where thousands fall, `%` as a hundredth (`50%` is 0.5, as in Excel
 *    and #53), a currency sign in front. It is what Excel and Google Sheets put on the clipboard, and
 *    a pasted column of them used to add up to 0. The text stays in the cell and shows as typed; the
 *    file gets the number with a matching format (`formattedNumber`). Commas in the wrong places
 *    (`1,25`), dashes (`081-234-5678`, `123-4-56789-0`) and a leading zero (`01,250`) stay text.
 * 7. Anything else that `Number()` accepts is a number.
 *
 * Nothing is stored to make the automatic rules work, so a sheet saved before they existed shows
 * its zeros again the moment it is opened.
 */
export function literalValue(raw: string, numberFormat?: NumberFormat): FormulaValue {
  if (raw === "") return null;
  if (raw.startsWith("'")) return raw.slice(1);
  if (numberFormat === "text") return raw;
  if (LEADING_ZERO.test(raw) || LONG_DIGITS.test(raw)) return raw;
  const date = dateLiteral(raw);
  if (date) return date.serial;
  const shown = formattedNumber(raw);
  if (shown) return shown.value;
  const n = Number(raw);
  return raw.trim() !== "" && !Number.isNaN(n) ? n : raw;
}

const LEADING_ZERO = /^0\d+$/;

/**
 * A number with thousands commas, a trailing percent or a leading currency sign: sign, then
 * currency, then digits grouped in threes, then decimals, then `%`. The sign may also sit after the
 * currency sign (`฿-1,500`), as some programs write it.
 */
const SHOWN_NUMBER = /^([-+])?([฿$€£¥])?\s?([-+])?((?:[1-9]\d{0,2}(?:,\d{3})+|\d+))(\.\d+)?(%)?$/;

export interface FormattedNumber {
  value: number;
  /** The Excel code the number goes out with, so the file shows it the way the cell did. */
  code: string;
}

/**
 * A number as a screen shows it (#52), or null for text that is not one — including a plain number
 * (`1250`), which needs no format of its own, and a code with a leading zero (`01,250`).
 */
export function formattedNumber(raw: string): FormattedNumber | null {
  const m = SHOWN_NUMBER.exec(raw.trim());
  if (!m) return null;
  const [, sign1, currency, sign2, whole, fraction = "", percent] = m;
  if (sign1 && sign2) return null;
  const grouped = whole.includes(",");
  if (!grouped && !currency && !percent) return null;
  if (!grouped && whole.length > 1 && whole.startsWith("0")) return null;
  const negative = (sign1 ?? sign2) === "-";
  const magnitude = Number(whole.replace(/,/g, "") + fraction);
  if (!Number.isFinite(magnitude)) return null;
  const value = (negative ? -magnitude : magnitude) / (percent ? 100 : 1);
  const decimals = fraction.length > 1 ? "." + "0".repeat(fraction.length - 1) : "";
  const body = (grouped || currency ? "#,##0" : "0") + decimals;
  const code = percent ? `0${decimals}%` : currency ? `"${currency}"${body}` : body;
  // Floating point: 12.5% is 0.125 exactly, but 0.1% would carry noise past 15 digits.
  return { value: Number(value.toPrecision(15)), code };
}
const LONG_DIGITS = /^\d{12,}$/;

/** Text a spreadsheet would read as a number if somebody typed it in: what Excel flags with a green corner. */
export function looksNumeric(text: string): boolean {
  return (text.trim() !== "" && !Number.isNaN(Number(text))) || formattedNumber(text) !== null;
}

/**
 * The cell text that reads back as exactly `text`, and as text.
 *
 * The other direction of `literalValue`, for text arriving from somewhere that already knows it is
 * text — a string cell in an .xlsx. `"0812345678"` needs nothing, the rules above keep it; `"123"`
 * would become the number 123, so it gets the apostrophe Excel itself would show in the formula bar.
 * So does text that starts with `=` (it would otherwise be run as a formula) or with an apostrophe
 * of its own (which would otherwise be eaten as the marker).
 */
export function rawForText(text: string): string {
  if (text === "") return "";
  const formula = text.startsWith("=") && text.length > 1;
  return formula || literalValue(text) !== text ? `'${text}` : text;
}
