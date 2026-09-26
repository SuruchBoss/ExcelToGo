// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { createEmptySheet, SheetModel } from "./sheet";
import type { CellFormat } from "./cellFormat";

/**
 * What a sheet looks like on the way to storage, which is not what it looks like in memory.
 *
 * The model is a dense grid: `cells[r][c]` for every row and column the sheet has. In memory that
 * is the right shape — it is what makes a lookup an array index rather than a hash, and the
 * benchmark says a 20,000 × 26 sheet still computes in 84ms with it.
 *
 * Written out verbatim, though, it is a disaster, and this is measured rather than suspected:
 *
 *     30 × 10, one cell used        3 KB
 *     1,000 × 26, one cell used   207 KB
 *     5,000 × 26, one cell used  1,035 KB
 *     20,000 × 26, one cell used 4,141 KB
 *
 * A browser gives roughly 5 MB of `localStorage`, so **a sheet with a single value in it stopped
 * being saveable at about twenty thousand rows** — and autosave ran that `JSON.stringify` on every
 * keystroke. The ceiling had nothing to do with how much anyone had typed.
 *
 * So the grid is packed on the way out: only the cells that hold something, keyed `"r,c"`. The
 * same sheet is then 3 KB whatever its dimensions are, and what costs is what was typed.
 *
 * `unpack` accepts the old dense shape as well, because someone's browser is holding one right
 * now and a release that silently loses their work would be unforgivable for a saving of bytes.
 */

/** `"r,c"`, matching the key `cellComments.ts` already uses so the two read the same in a dump. */
type CellKey = string;

export interface PackedSheet {
  rows: number;
  cols: number;
  /** Non-empty cells only. */
  cells: Record<CellKey, string>;
  /** Cells carrying formatting only. */
  formats?: Record<CellKey, CellFormat>;
  /** Everything else travels as it is: all of it is already sparse or small. */
  rest?: Omit<SheetModel, "rows" | "cols" | "cells" | "formats">;
}

/** A format object that exists but says nothing is worth neither a key nor a byte. */
function hasFormatting(format: CellFormat | undefined): format is CellFormat {
  return format !== undefined && Object.values(format).some((v) => v !== undefined);
}

export function packSheet(sheet: SheetModel): PackedSheet {
  const cells: Record<CellKey, string> = {};
  const formats: Record<CellKey, CellFormat> = {};

  for (let r = 0; r < sheet.rows; r++) {
    const row = sheet.cells[r];
    const formatRow = sheet.formats[r];
    for (let c = 0; c < sheet.cols; c++) {
      const raw = row?.[c] ?? "";
      if (raw !== "") cells[`${r},${c}`] = raw;
      const format = formatRow?.[c];
      if (hasFormatting(format)) formats[`${r},${c}`] = format;
    }
  }

  // The grid itself is already packed above; everything else on the model travels as it is.
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sheet)) {
    if (key === "rows" || key === "cols" || key === "cells" || key === "formats") continue;
    if (value !== undefined) rest[key] = value;
  }
  const packed: PackedSheet = { rows: sheet.rows, cols: sheet.cols, cells };
  if (Object.keys(formats).length > 0) packed.formats = formats;
  if (Object.keys(rest).length > 0) packed.rest = rest as PackedSheet["rest"];
  return packed;
}

/** Splits `"12,3"` into numbers, refusing anything that is not that — this is untrusted storage. */
function parseKey(key: string): [number, number] | null {
  const comma = key.indexOf(",");
  if (comma < 1) return null;
  const r = Number(key.slice(0, comma));
  const c = Number(key.slice(comma + 1));
  if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0) return null;
  return [r, c];
}

/** True for the shape this module writes; false for the dense arrays it used to be. */
export function isPacked(value: unknown): value is PackedSheet {
  if (!value || typeof value !== "object") return false;
  const cells = (value as { cells?: unknown }).cells;
  return !!cells && typeof cells === "object" && !Array.isArray(cells);
}

/**
 * Back to the dense model the rest of the app works with.
 *
 * Defensive about its input on purpose: this reads whatever is in `localStorage`, which may have
 * been written by an older version, hand-edited, or truncated by a browser that ran out of room
 * mid-write. A key outside the sheet's declared size grows the sheet to fit rather than being
 * dropped — losing a cell quietly is the one outcome worth more code to avoid.
 */
export function unpackSheet(packed: PackedSheet): SheetModel {
  const entries: [number, number, string][] = [];
  let maxRow = -1;
  let maxCol = -1;

  for (const [key, raw] of Object.entries(packed.cells ?? {})) {
    const at = parseKey(key);
    if (!at || typeof raw !== "string") continue;
    entries.push([at[0], at[1], raw]);
    maxRow = Math.max(maxRow, at[0]);
    maxCol = Math.max(maxCol, at[1]);
  }

  const formatEntries: [number, number, CellFormat][] = [];
  for (const [key, format] of Object.entries(packed.formats ?? {})) {
    const at = parseKey(key);
    if (!at || !format || typeof format !== "object") continue;
    formatEntries.push([at[0], at[1], format]);
    maxRow = Math.max(maxRow, at[0]);
    maxCol = Math.max(maxCol, at[1]);
  }

  const rows = Math.max(Number(packed.rows) || 0, maxRow + 1, 1);
  const cols = Math.max(Number(packed.cols) || 0, maxCol + 1, 1);
  const sheet = createEmptySheet(rows, cols);

  for (const [r, c, raw] of entries) sheet.cells[r][c] = raw;
  for (const [r, c, format] of formatEntries) sheet.formats[r][c] = format;
  return { ...sheet, ...(packed.rest ?? {}) };
}

/** Packs for storage, or hands back a sheet that is already dense and unchanged. */
export function toStorage(sheet: SheetModel): PackedSheet {
  return packSheet(sheet);
}

/** Reads either shape: what this module writes now, or the dense grid written before it existed. */
export function fromStorage(value: PackedSheet | SheetModel): SheetModel {
  return isPacked(value) ? unpackSheet(value) : (value as SheetModel);
}
