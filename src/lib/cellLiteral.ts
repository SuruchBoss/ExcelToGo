// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

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
 * 2. **An integer with a leading zero** (`0812345678`, `00123`) is text. Nobody means `00123` as
 *    the number 123; they mean a code. `0` and `0.5` are still numbers.
 * 3. **Twelve digits or more, nothing else** (`1234567890123`) is text. Past that length it is an
 *    ID card, an account or a barcode, not an amount, and Excel's own answer — show it as
 *    1.23457E+12 and round off the tail past fifteen digits — destroys it.
 * 4. Anything else that `Number()` accepts is a number.
 *
 * Nothing is stored to make the automatic rules work, so a sheet saved before they existed shows
 * its zeros again the moment it is opened.
 */
export function literalValue(raw: string): FormulaValue {
  if (raw === "") return null;
  if (raw.startsWith("'")) return raw.slice(1);
  if (LEADING_ZERO.test(raw) || LONG_DIGITS.test(raw)) return raw;
  const n = Number(raw);
  return raw.trim() !== "" && !Number.isNaN(n) ? n : raw;
}

const LEADING_ZERO = /^0\d+$/;
const LONG_DIGITS = /^\d{12,}$/;
