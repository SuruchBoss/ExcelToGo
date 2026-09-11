import { CellValue, TableColumn, TableData } from "./types";

type Json = unknown;
type Record_ = Record<string, Json>;

function isRecord(v: Json): v is Record_ {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isRecordArray(v: Json): v is Record_[] {
  return Array.isArray(v) && v.length > 0 && v.every(isRecord);
}

/** Walks a dot-path like "data.items" (array indices allowed: "data.0.items"). */
export function getByPath(json: Json, path: string | undefined): Json {
  if (!path || !path.trim()) return json;
  let cur: Json = json;
  for (const seg of path.split(".").map((s) => s.trim()).filter(Boolean)) {
    if (Array.isArray(cur) && /^\d+$/.test(seg)) cur = cur[Number(seg)];
    else if (isRecord(cur)) cur = cur[seg];
    else return undefined;
  }
  return cur;
}

/** Breadth-first search for the largest array of records anywhere in the response — API payloads
 *  almost always wrap their real data ({ data: { items: [...] } }), and users shouldn't have to know
 *  the wrapper's key names to get a table out of it. */
function findLargestRecordArray(json: Json): Record_[] | null {
  let best: Record_[] | null = null;
  const queue: Json[] = [json];
  let guard = 0;
  while (queue.length && guard++ < 5000) {
    const cur = queue.shift();
    if (isRecordArray(cur)) {
      if (!best || cur.length > best.length) best = cur;
      continue;
    }
    if (isRecord(cur)) queue.push(...Object.values(cur));
    else if (Array.isArray(cur)) queue.push(...cur);
  }
  return best;
}

function toCell(v: Json): CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") return v;
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || ["string", "number", "boolean"].includes(typeof x))) {
      return v.map((x) => (x === null ? "" : String(x))).join(", ");
    }
    return `${v.length} items`;
  }
  return JSON.stringify(v);
}

/** Flattens one record: nested objects become "a.b" keys; everything else becomes a cell value. */
function flattenRecord(rec: Record_, prefix = "", out: Record<string, CellValue> = {}): Record<string, CellValue> {
  for (const [k, v] of Object.entries(rec)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isRecord(v)) flattenRecord(v, key, out);
    else out[key] = toCell(v);
  }
  return out;
}

function labelFor(key: string): string {
  return key.split(".").join(" › ");
}

/**
 * Finds the list of records a payload is really about:
 * - an array of objects → itself
 * - an array of primitives → one `{ value }` record each
 * - a wrapped payload → the largest array of objects found inside it
 *
 * Returns null when the payload is a single object (a KPI response, say) or a bare primitive —
 * there is no list to page through, so callers that follow pagination know to stop.
 */
export function extractRecords(json: Json): Record_[] | null {
  if (isRecordArray(json)) return json;
  if (Array.isArray(json)) return json.map((v) => ({ value: v }));
  return isRecord(json) ? findLargestRecordArray(json) : null;
}

/** Flattens a list of records into a rectangular table whose columns are the union of their keys. */
export function tableFromRecords(
  records: Record_[],
  fetchedAt = new Date().toISOString(),
  extra: Pick<TableData, "pageCount" | "truncated" | "retryAfterSec"> = {}
): TableData {
  const flat = records.map((r) => flattenRecord(r));
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of flat) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }

  const rows = flat.map((row) => keys.map((k) => row[k] ?? null));
  const columns: TableColumn[] = keys.map((key, i) => ({
    key,
    label: labelFor(key),
    numeric: rows.length > 0 && rows.every((r) => r[i] === null || typeof r[i] === "number"),
  }));
  return { columns, rows, fetchedAt, ...extra };
}

/**
 * Turns any JSON payload into a rectangular table a non-technical user can read:
 * - an array of objects → one row per object
 * - a wrapped payload → the largest array of objects found inside it
 * - a single object → a single-row table (its fields become the columns)
 * - an array of primitives → a one-column "value" table
 */
export function jsonToTable(json: Json, fetchedAt = new Date().toISOString()): TableData {
  const records = extractRecords(json) ?? (isRecord(json) ? [json] : [{ value: json }]);
  return tableFromRecords(records, fetchedAt);
}

/** Minimal RFC-4180-ish CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function coerce(s: string): CellValue {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isNaN(n) ? s : n;
}

/** First CSV line is treated as the header. */
export function csvToTable(text: string, fetchedAt = new Date().toISOString()): TableData {
  const lines = parseCsv(text);
  if (lines.length === 0) return { columns: [], rows: [], fetchedAt };
  const [header, ...body] = lines;
  const rows = body.map((line) => header.map((_, i) => coerce(line[i] ?? "")));
  const columns: TableColumn[] = header.map((h, i) => ({
    key: h || `col${i + 1}`,
    label: h || `col${i + 1}`,
    numeric: rows.length > 0 && rows.every((r) => r[i] === null || typeof r[i] === "number"),
  }));
  return { columns, rows, fetchedAt };
}
