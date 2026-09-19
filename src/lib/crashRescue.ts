/**
 * Getting the work out after the app has already failed.
 *
 * Everything else in this project assumes the app is running. This module assumes it is not: it is
 * what the error boundary calls once React has given up on rendering, and its only job is to turn
 * whatever is sitting in `localStorage` into files the person can keep.
 *
 * Two rules follow from that, and they are the reason this is its own module rather than a few
 * lines inside `error.tsx`:
 *
 * - **It never touches the store, the model or the formula engine.** Any of those could be the
 *   thing that just threw. It reads the persisted JSON as raw, untrusted data — the same posture
 *   as reading a file someone uploaded — and copes with every field being missing or the wrong
 *   type. A rescue path that crashes is worse than none, because it fails at the exact moment the
 *   person has already lost confidence in the app.
 * - **It is pure.** A `raw` string in, files out, no `window`. So the interesting part is reachable
 *   from a test with a string literal, which matters for code that by definition only ever runs on
 *   the worst day.
 *
 * Quoting is reused from `csv.ts` rather than reimplemented — it is pure text handling, and a
 * second copy of CSV escaping is a second place for it to be wrong.
 */

import { toCsv, trimGrid } from "./csv";

/**
 * Where the sheet store persists. Deliberately a literal rather than an import from the store:
 * pulling the store in would drag the model and the engine into the one code path that has to keep
 * working when they are broken. `crashRescue.test.ts` reads the store's source and fails if the two
 * ever drift apart, which is the part a comment cannot enforce.
 */
export const PERSIST_KEY = "exceltogo-sheet-v2";

export interface RescuedSheet {
  /** The tab's name, or a generated one if the stored name is missing or unusable. */
  name: string;
  /** A filename that is safe on Windows, macOS and Linux alike. */
  filename: string;
  /** CSV with a BOM, so Thai opens correctly in Excel rather than as mojibake. */
  csv: string;
}

/** Cells are strings in the model, but this is untrusted JSON: anything could be in there. */
function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/**
 * The cells, whichever way storage is holding them.
 *
 * Two shapes exist and both have to work: the dense `string[][]` written before `sheetCodec.ts`,
 * and the packed `{ "r,c": text }` written since. This module deliberately imports neither the
 * store nor the codec — it has to keep working when those are what broke — so it reads both here,
 * which is nine lines and the difference between rescuing a sheet and reporting there is nothing
 * to rescue while it sits right there in storage.
 */
function asGrid(value: unknown): string[][] {
  if (Array.isArray(value)) return value.filter(Array.isArray).map((row) => (row as unknown[]).map(asText));
  if (!value || typeof value !== "object") return [];

  const rows: string[][] = [];
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const comma = key.indexOf(",");
    if (comma < 1) continue;
    const r = Number(key.slice(0, comma));
    const c = Number(key.slice(comma + 1));
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0) continue;
    while (rows.length <= r) rows.push([]);
    while (rows[r].length <= c) rows[r].push("");
    rows[r][c] = asText(raw);
  }
  // Ragged by construction — a row with a cell in column 9 and nothing else is nine entries long
  // while its neighbour is one. `toCsv` pads per row, so this stays as it is.
  return rows;
}

const UNSAFE_IN_FILENAME = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * Strips what a filesystem or a download header would choke on. Windows is the strict one: the
 * nine characters above are all forbidden there, and so are trailing dots and spaces.
 */
export function safeFilename(name: string, fallback: string): string {
  const cleaned = name
    .replace(UNSAFE_IN_FILENAME, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")
    .slice(0, 60)
    .trim();
  return `${cleaned || fallback}.csv`;
}

/**
 * Turns the persisted blob into one CSV per tab.
 *
 * Returns an empty array for anything it cannot make sense of — no storage, unparseable JSON, a
 * shape from some future version — so the caller's only branch is "is there anything to offer".
 *
 * Formulas come out as the text the person typed (`=SUM(A1:A2)`), not as values: nothing here
 * evaluates anything, and handing back the source is both honest and more useful than a number
 * would be.
 */
export function rescueSheets(raw: string | null | undefined): RescuedSheet[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  // zustand's persist wraps the partialized state in `{ state, version }`. Accept the bare state
  // too, so a hand-edited backup or an older shape still rescues.
  const root = parsed as { state?: unknown } | null;
  const state = (root && typeof root === "object" && "state" in root ? root.state : parsed) as
    | { sheets?: unknown }
    | null;
  const tabs = state && typeof state === "object" ? state.sheets : undefined;
  if (!Array.isArray(tabs)) return [];

  const out: RescuedSheet[] = [];
  const used = new Set<string>();

  tabs.forEach((tab, i) => {
    const t = tab as { name?: unknown; sheet?: { cells?: unknown } } | null;
    const grid = trimGrid(asGrid(t?.sheet?.cells));
    if (grid.length === 0) return;

    const name = typeof t?.name === "string" && t.name.trim() !== "" ? t.name.trim() : `Sheet${i + 1}`;
    let filename = safeFilename(name, `Sheet${i + 1}`);
    // Two tabs may legitimately share a name, and two downloads with one filename lose one of them.
    for (let n = 2; used.has(filename); n++) filename = safeFilename(`${name} (${n})`, `Sheet${i + 1}`);
    used.add(filename);

    out.push({ name, filename, csv: toCsv(grid) });
  });

  return out;
}
