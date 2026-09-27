// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { csvToTable, extractRecords, getByPath, jsonToTable, tableFromRecords } from "./jsonToTable";
import { DEFAULT_MAX_ROWS, MAX_PAGES, nextPageUrl } from "./paginate";
import { RateLimitError } from "./rateLimit";
import { MAX_RESPONSE_BYTES, SOURCE_TOO_LARGE, SourceLimitError, TOTAL_BUDGET_MS } from "./fetchLimits";
import type { DataSourceConfig, TableData } from "./types";

/**
 * Reading a source into a table, whoever makes the requests.
 *
 * Two callers make requests in different ways — the server (`src/lib/server/executeSource.ts`),
 * which follows redirects by hand and checks every destination against its private-network guard,
 * and the browser (`browserSource.ts`), which fetches the user's own API from the user's own
 * machine. What happens between the requests is the same for both and lives here once: the byte and
 * time budget, reading a body as a stream, telling JSON from CSV, following pages, the rate limit,
 * and saying when a table is only part of the data. A second copy of this is how the two would come
 * to disagree about what "partial" means.
 */

/**
 * What one refresh may still spend. Shared by every request it makes — the redirects and the pages
 * — so the limits bound the refresh, not each request separately: twenty pages each just under a
 * per-page cap would otherwise add up to twenty times the memory the cap was meant to allow.
 */
export interface Budget {
  /** `Date.now()` past which nothing more is sent or read. */
  deadline: number;
  /** Decompressed body bytes still allowed. */
  bytesLeft: number;
}

export const newBudget = (now = Date.now()): Budget => ({ deadline: now + TOTAL_BUDGET_MS, bytesLeft: MAX_RESPONSE_BYTES });

/**
 * The body, read as a stream and stopped the moment it passes the budget.
 *
 * `res.text()` has no limit: it reads whatever arrives, and `fetch` has already inflated gzip and
 * brotli by then, so a small reply on the wire can be an enormous string in memory. Counting the
 * chunks as they come means a body that is too big costs at most the budget plus one chunk.
 * A declared `content-length` over the budget is refused before a byte is read.
 */
export async function readBody(res: Response, budget: Budget): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > budget.bytesLeft) {
    await res.body?.cancel().catch(() => {});
    throw new SourceLimitError(SOURCE_TOO_LARGE);
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    budget.bytesLeft -= value.byteLength;
    if (budget.bytesLeft < 0) {
      await reader.cancel().catch(() => {});
      throw new SourceLimitError(SOURCE_TOO_LARGE);
    }
    parts.push(decoder.decode(value, { stream: true }));
  }
  parts.push(decoder.decode());
  return parts.join("");
}

/**
 * The answer arrived but is not something a table can be made of — not JSON or CSV, or no list at
 * the path the source names. `keys` are the top-level keys that *were* there, so the person setting
 * the source up is shown what to put in the path instead of being told only that it is wrong.
 */
export class NotATableError extends Error {
  constructor(
    message: string,
    readonly keys: string[]
  ) {
    super(message);
    this.name = "NotATableError";
  }
}

const topKeys = (json: unknown): string[] =>
  json && typeof json === "object" && !Array.isArray(json) ? Object.keys(json).slice(0, 8) : [];

export function parseBody(text: string): { json: unknown } | { csv: string } {
  try {
    return { json: JSON.parse(text) };
  } catch {
    // Some "JSON" endpoints are really CSV — be forgiving rather than making the user pick the type.
    if (text.includes(",") && text.includes("\n")) return { csv: text };
    throw new NotATableError("Response is not valid JSON", []);
  }
}

/** One page's text, and the `Link` header that may say where the next one is. */
export interface FetchedText {
  text: string;
  linkHeader: string | null;
}

/**
 * Makes one request. `first` is true only for the source's own URL — a later page's URL came from a
 * response, and the server treats those as untrusted even when the first one was its own endpoint.
 */
export type PageFetcher = (url: string, first: boolean) => Promise<FetchedText>;

export interface CollectInput extends Pick<DataSourceConfig, "type" | "jsonPath" | "maxRows"> {
  /** The source's own URL, absolute. */
  startUrl: string;
  /** Pages are followed only on this origin: the one the source's own URL is on. */
  credentialOrigin: string;
  budget: Budget;
  fetchPage: PageFetcher;
}

/**
 * Fetches a source and normalizes whatever it returns into a TableData.
 *
 * When the first response looks like a list and signals a next page, following pages are fetched
 * and their records appended, up to `maxRows` (and never more than MAX_PAGES requests or the total
 * time budget). Stopping early sets `truncated` so the UI can say the table is only part of the
 * data — showing a silently partial table is the one outcome worth avoiding here.
 */
export async function collectTable({ type, jsonPath, maxRows: wanted, startUrl, credentialOrigin, budget, fetchPage }: CollectInput): Promise<TableData> {
  const first = await fetchPage(startUrl, true);
  const fetchedAt = new Date().toISOString();

  const parsed = parseBody(first.text);
  if (type === "csv" || "csv" in parsed) {
    return csvToTable("csv" in parsed ? parsed.csv : first.text, fetchedAt);
  }

  const scoped = getByPath(parsed.json, jsonPath);
  if (scoped === undefined) throw new NotATableError(`Nothing found at path "${jsonPath}"`, topKeys(parsed.json));

  const maxRows = wanted === undefined ? DEFAULT_MAX_ROWS : wanted;
  const records = extractRecords(scoped);
  // No list to page through (a KPI object, a bare value), or paging switched off.
  if (!records || maxRows <= 0) return jsonToTable(scoped, fetchedAt);

  const firstPageRecords = records.length;
  const seen = new Set<string>([startUrl]);
  const all = [...records];

  let page = { body: parsed.json, linkHeader: first.linkHeader, records: firstPageRecords };
  let currentUrl = startUrl;
  let pageCount = 1;
  let truncated = false;
  let retryAfterSec: number | undefined;

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
    // A next page on another origin is not followed at all — and so the source's header is never
    // sent there. An API whose pages continue on a different host is not something real APIs do;
    // the rows already collected are kept and marked partial rather than fetched from somewhere the
    // person setting the source up never named.
    if (new URL(nxt.url).origin !== credentialOrigin) {
      truncated = true;
      break;
    }
    if (all.length >= maxRows || pageCount >= MAX_PAGES || Date.now() > budget.deadline || seen.has(nxt.url)) {
      truncated = true; // There is more data; we're choosing to stop.
      break;
    }

    seen.add(nxt.url);
    currentUrl = nxt.url;
    let next: FetchedText;
    try {
      next = await fetchPage(currentUrl, false);
    } catch (err) {
      // A rate limit partway through is the one failure worth carrying forward rather than just
      // swallowing: the rows already collected are still good, but the caller has to know to wait
      // or the next poll walks straight back into the same limit. Running out of time or bytes on
      // a later page is the same as running out of pages — what was collected is kept, marked
      // partial.
      if (err instanceof RateLimitError) retryAfterSec = err.retryAfterSec;
      truncated = true;
      break;
    }

    let nextParsed: ReturnType<typeof parseBody>;
    try {
      nextParsed = parseBody(next.text);
    } catch {
      truncated = true;
      break;
    }
    if ("csv" in nextParsed) {
      truncated = true;
      break;
    }
    const nextRecords = extractRecords(getByPath(nextParsed.json, jsonPath)) ?? [];
    pageCount += 1;
    all.push(...nextRecords);
    page = { body: nextParsed.json, linkHeader: next.linkHeader, records: nextRecords.length };
  }

  if (all.length > maxRows) {
    all.length = maxRows;
    truncated = true;
  }
  return tableFromRecords(all, fetchedAt, { pageCount, truncated: truncated || undefined, retryAfterSec });
}
