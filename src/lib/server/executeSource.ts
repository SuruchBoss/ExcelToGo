import { csvToTable, extractRecords, getByPath, jsonToTable, tableFromRecords } from "@/lib/dataSources/jsonToTable";
import { DEFAULT_MAX_ROWS, MAX_PAGES, nextPageUrl } from "@/lib/dataSources/paginate";
import { DataSourceConfig, TableData } from "@/lib/dataSources/types";

export type SourceInput = Pick<DataSourceConfig, "type" | "url" | "method" | "authHeader" | "jsonPath" | "maxRows">;

/** Per request. A slow page shouldn't be able to hold a refresh open indefinitely. */
const REQUEST_TIMEOUT_MS = 15_000;
/** Across every page of one refresh, so a source with many pages still finishes in bounded time. */
const TOTAL_BUDGET_MS = 45_000;

type FetchedPage = { body: unknown; linkHeader: string | null; records: number };

async function fetchPage(url: string, src: SourceInput): Promise<{ text: string; linkHeader: string | null }> {
  const headers: Record<string, string> = { Accept: "application/json, text/csv, text/plain;q=0.9, */*;q=0.8" };
  if (src.authHeader?.name && src.authHeader.value) headers[src.authHeader.name] = src.authHeader.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { method: src.method ?? "GET", headers, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
  return { text: await res.text(), linkHeader: res.headers.get("link") };
}

function parseBody(text: string): { json: unknown } | { csv: string } {
  try {
    return { json: JSON.parse(text) };
  } catch {
    // Some "JSON" endpoints are really CSV — be forgiving rather than making the user pick the type.
    if (text.includes(",") && text.includes("\n")) return { csv: text };
    throw new Error("Response is not valid JSON");
  }
}

/**
 * Fetches a source and normalizes whatever it returns into a TableData. Runs on the server so
 * the auth header never reaches the browser and CORS isn't the user's problem. `origin` lets an
 * app-relative URL ("/api/demo/sales") resolve against the current deployment.
 *
 * When the first response looks like a list and signals a next page, following pages are fetched
 * and their records appended, up to `maxRows` (and never more than MAX_PAGES requests or the total
 * time budget). Stopping early sets `truncated` so the UI can say the table is only part of the
 * data — showing a silently partial table is the one outcome worth avoiding here.
 */
export async function executeSource(src: SourceInput, origin: string): Promise<TableData> {
  const startUrl = src.url.startsWith("/") ? new URL(src.url, origin).toString() : src.url;
  const first = await fetchPage(startUrl, src);
  const fetchedAt = new Date().toISOString();

  const parsed = parseBody(first.text);
  if (src.type === "csv" || "csv" in parsed) {
    return csvToTable("csv" in parsed ? parsed.csv : first.text, fetchedAt);
  }

  const scoped = getByPath(parsed.json, src.jsonPath);
  if (scoped === undefined) throw new Error(`Nothing found at path "${src.jsonPath}"`);

  const maxRows = src.maxRows === undefined ? DEFAULT_MAX_ROWS : src.maxRows;
  const records = extractRecords(scoped);
  // No list to page through (a KPI object, a bare value), or paging switched off.
  if (!records || maxRows <= 0) return jsonToTable(scoped, fetchedAt);

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const firstPageRecords = records.length;
  const seen = new Set<string>([startUrl]);
  const all = [...records];

  let page: FetchedPage = { body: parsed.json, linkHeader: first.linkHeader, records: firstPageRecords };
  let currentUrl = startUrl;
  let pageCount = 1;
  let truncated = false;

  for (;;) {
    // Ask where the next page is first, then decide whether we're allowed to go there. Doing it
    // in this order is what lets "stopped at exactly maxRows, but more exists" report as truncated.
    const nxt = nextPageUrl({
      currentUrl,
      linkHeader: page.linkHeader,
      body: page.body,
      pageRecords: page.records,
      firstPageRecords,
    });
    if (!nxt) break; // Genuinely the last page.
    if (all.length >= maxRows || pageCount >= MAX_PAGES || Date.now() > deadline || seen.has(nxt.url)) {
      truncated = true; // There is more data; we're choosing to stop.
      break;
    }

    seen.add(nxt.url);
    currentUrl = nxt.url;
    let next: { text: string; linkHeader: string | null };
    try {
      next = await fetchPage(currentUrl, src);
    } catch {
      // One bad page shouldn't throw away the rows already in hand — return them, marked partial.
      truncated = true;
      break;
    }

    const nextParsed = parseBody(next.text);
    if ("csv" in nextParsed) {
      truncated = true;
      break;
    }
    const nextRecords = extractRecords(getByPath(nextParsed.json, src.jsonPath)) ?? [];
    pageCount += 1;
    all.push(...nextRecords);
    page = { body: nextParsed.json, linkHeader: next.linkHeader, records: nextRecords.length };
  }

  if (all.length > maxRows) {
    all.length = maxRows;
    truncated = true;
  }
  return tableFromRecords(all, fetchedAt, { pageCount, truncated: truncated || undefined });
}
