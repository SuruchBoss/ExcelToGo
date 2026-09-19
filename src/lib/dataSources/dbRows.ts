import { CellValue, TableColumn, TableData } from "./types";

/**
 * Turns what a database driver hands back into the same `TableData` the REST path produces.
 *
 * Kept here, away from the drivers, for one reason: this is where every judgement call lives —
 * what a `numeric` column of arbitrary precision becomes, what a timestamp looks like in a cell,
 * what happens to a JSON column — and none of those need a database to test. The driver code that
 * *does* need one is then thin enough to read in one sitting.
 */

/**
 * One value, as a cell.
 *
 * The cases in order of how badly they go wrong when guessed:
 *
 *  - **A big integer or an exact `numeric`** arrives as a string from both drivers, deliberately,
 *    because it does not fit a double. Turning it back into a number here would lose the digits
 *    the driver went out of its way to keep, so it stays text — and the column stops being
 *    numeric, which is the honest outcome: a total over rounded money is worse than no total.
 *  - **A date** becomes an ISO string rather than a locale rendering, so sorting in the sheet is
 *    still chronological.
 *  - **Binary** becomes a short note about its size. A megabyte of base64 in one cell helps nobody
 *    and makes the export unopenable.
 *  - **JSON and arrays** become compact JSON, which is at least readable and pasteable.
 */
export function toCellValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "string") return value;
  if (isBinary(value)) return `⟨${value.byteLength} bytes⟩`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isBinary(v: unknown): v is { byteLength: number } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { byteLength?: unknown }).byteLength === "number" &&
    (ArrayBuffer.isView(v) || v instanceof ArrayBuffer)
  );
}

/** A column heading from a database is already a name somebody chose; it is shown as written. */
function labelFor(key: string): string {
  return key;
}

/**
 * Rows plus the column names the query returned.
 *
 * The names come from the driver rather than from the first row's keys, because a query can select
 * a column that is `null` in every row and a query can select the same name twice. Both of those
 * vanish if the columns are inferred from an object.
 */
export function tableFromDbRows(
  columnNames: string[],
  rows: unknown[][],
  fetchedAt = new Date().toISOString(),
  extra: Pick<TableData, "truncated"> = {}
): TableData {
  // Two columns called `id` would otherwise be one column in the sheet, quietly holding the second
  // one's values. Suffixed rather than dropped: the operator can see what happened and alias it.
  const used = new Map<string, number>();
  const keys = columnNames.map((raw) => {
    const name = raw === "" ? "?column?" : raw;
    const seen = used.get(name) ?? 0;
    used.set(name, seen + 1);
    return seen === 0 ? name : `${name} (${seen + 1})`;
  });

  const cells: CellValue[][] = rows.map((row) => keys.map((_, i) => toCellValue(row[i])));
  const columns: TableColumn[] = keys.map((key, i) => ({
    key,
    label: labelFor(key),
    // An all-empty column is not numeric: nothing in it says it is, and calling it numeric
    // right-aligns a column of blanks.
    numeric: cells.length > 0 && cells.some((r) => typeof r[i] === "number") && cells.every((r) => r[i] === null || typeof r[i] === "number"),
  }));
  return { columns, rows: cells, fetchedAt, ...extra };
}
