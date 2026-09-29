// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * What Excel allows a sheet to be called, in one place (#54).
 *
 * The app used to accept any name and let the `.xlsx` writer cope. It coped badly in every
 * direction: a second "Sheet3" quietly took over the formulas written for the first, `sheet1`
 * beside `Sheet1` made the export throw with nothing on screen, and `Q1/Q2` went out as a tab
 * called "Q1 Q2" while its formulas still said `'Q1/Q2'!A1`. Excel's rules are few and fixed, so
 * they are enforced when a name is made — typed, added, imported or loaded — rather than repaired
 * on the way out, where no formula can follow the repair.
 *
 * The rules, from Excel's own rename box: 1–31 characters; none of `\ / ? * [ ] :`; not starting
 * or ending with an apostrophe; not "History", which Excel keeps for itself; and unique in the
 * workbook ignoring case, because Excel compares `Sheet1` and `SHEET1` as the same name.
 */

export const SHEET_NAME_MAX = 31;

export type SheetNameProblem = "empty" | "tooLong" | "badChar" | "apostrophe" | "reserved" | "taken";

const FORBIDDEN = /[\\/?*[\]:]/;
const FORBIDDEN_ALL = /[\\/?*[\]:]/g;

/** Why Excel would refuse `name` beside `others`, or null when it would take it. */
export function sheetNameProblem(name: string, others: readonly string[]): SheetNameProblem | null {
  const n = name.trim();
  if (!n) return "empty";
  if (n.length > SHEET_NAME_MAX) return "tooLong";
  if (FORBIDDEN.test(n)) return "badChar";
  if (n.startsWith("'") || n.endsWith("'")) return "apostrophe";
  if (n.toLowerCase() === "history") return "reserved";
  if (others.some((o) => o.toLowerCase() === n.toLowerCase())) return "taken";
  return null;
}

/**
 * The nearest name Excel would take, ignoring whether it is free: each forbidden character becomes
 * a space (so `Q1/Q2` reads as `Q1 Q2` rather than `Q1Q2`), apostrophes come off the ends, and the
 * rest is cut to 31 characters.
 */
export function cleanSheetName(name: string): string {
  const clean = name
    .replace(FORBIDDEN_ALL, " ")
    .trim()
    .replace(/^'+|'+$/g, "")
    .trim()
    .slice(0, SHEET_NAME_MAX)
    .trim();
  return !clean || clean.toLowerCase() === "history" ? "Sheet" : clean;
}

/**
 * `base`, or `base (2)`, `base (3)`… — the first not in `taken` (lower-cased names). The suffix is
 * what has to survive the 31-character limit, so the base is the part that gets shortened.
 */
export function uniqueSheetName(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = base.slice(0, SHEET_NAME_MAX - suffix.length).trimEnd() + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/**
 * The name the + button gives a new tab: `Sheet<n>` for the first n not already used. Counting the
 * tabs was the bug — delete Sheet2 of three and the count says the next one is Sheet3, which is
 * already there.
 */
export function nextSheetName(names: readonly string[]): string {
  const taken = new Set(names.map((n) => n.toLowerCase()));
  let n = names.length + 1;
  while (taken.has(`sheet${n}`)) n += 1;
  return `Sheet${n}`;
}
