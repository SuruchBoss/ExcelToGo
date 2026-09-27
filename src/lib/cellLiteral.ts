// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { NumberFormat } from "./cellFormat";
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
 * 5. Anything else that `Number()` accepts is a number.
 *
 * Nothing is stored to make the automatic rules work, so a sheet saved before they existed shows
 * its zeros again the moment it is opened.
 */
export function literalValue(raw: string, numberFormat?: NumberFormat): FormulaValue {
  if (raw === "") return null;
  if (raw.startsWith("'")) return raw.slice(1);
  if (numberFormat === "text") return raw;
  if (LEADING_ZERO.test(raw) || LONG_DIGITS.test(raw)) return raw;
  const n = Number(raw);
  return raw.trim() !== "" && !Number.isNaN(n) ? n : raw;
}

const LEADING_ZERO = /^0\d+$/;
const LONG_DIGITS = /^\d{12,}$/;

/** Text a spreadsheet would read as a number if somebody typed it in: what Excel flags with a green corner. */
export function looksNumeric(text: string): boolean {
  return text.trim() !== "" && !Number.isNaN(Number(text));
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
