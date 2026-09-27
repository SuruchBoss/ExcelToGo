// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { csvToTable, extractRecords, getByPath, jsonToTable, tableFromRecords } from "@/lib/dataSources/jsonToTable";
import { DEFAULT_MAX_ROWS, MAX_PAGES, nextPageUrl } from "@/lib/dataSources/paginate";
import { RateLimitError, readRateLimit } from "@/lib/dataSources/rateLimit";
import { DataSourceConfig, isDbType, TableData } from "@/lib/dataSources/types";
import {
  MAX_RESPONSE_BYTES,
  REQUEST_TIMEOUT_MS,
  SOURCE_TIMED_OUT,
  SOURCE_TOO_LARGE,
  SourceLimitError,
  TOTAL_BUDGET_MS,
} from "@/lib/dataSources/fetchLimits";
import { executeDbSource } from "./executeDbSource";
import { assertFetchable } from "./urlGuard";

export type SourceInput = Pick<
  DataSourceConfig,
  "type" | "url" | "method" | "authHeader" | "jsonPath" | "maxRows" | "connection" | "query"
>;

/** Redirect hops followed per request, each one re-checked. */
const MAX_REDIRECTS = 5;

type FetchedPage = { body: unknown; linkHeader: string | null; records: number };

/**
 * What one refresh may still spend. Shared by every request it makes — the redirects and the pages
 * — so the limits bound the refresh, not each request separately: twenty pages each just under a
 * per-page cap would otherwise add up to twenty times the memory the cap was meant to allow.
 */
interface Budget {
  /** `Date.now()` past which nothing more is sent or read. */
  deadline: number;
  /** Decompressed body bytes still allowed. */
  bytesLeft: number;
}

/**
 * The body, read as a stream and stopped the moment it passes the budget.
 *
 * `res.text()` has no limit: it reads whatever arrives, and `fetch` has already inflated gzip and
 * brotli by then, so a small reply on the wire can be an enormous string in memory. Counting the
 * chunks as they come means a body that is too big costs at most the budget plus one chunk.
 * A declared `content-length` over the budget is refused before a byte is read.
 */
async function readBody(res: Response, budget: Budget): Promise<string> {
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
 * One request, with the destination checked before it is made and again after every redirect.
 *
 * Redirects are followed here rather than by fetch() because fetch's own following would take the
 * request wherever it is sent without asking — and "302 to 169.254.169.254" is exactly how a
 * checked URL becomes an unchecked one.
 *
 * `sameOrigin` marks the app's own demo endpoints, which are reached through a relative path and
 * are the one case where a loopback address is not a warning sign: the host isn't user-controlled,
 * it is this deployment.
 *
 * `credentialOrigin` is the origin the source's auth header was configured for — the scheme, host
 * and port of its own URL. The header goes only to that origin. Following redirects by hand means
 * fetch's own rule (drop `Authorization` when a redirect changes origin) no longer applies, so it
 * is applied here, to whatever header name the source uses: a hop to another origin is still
 * followed and still checked, but without the header, and it is not put back if a later hop
 * returns — the same as fetch. https → http on the same host is another origin.
 */
async function fetchPage(
  url: string,
  src: SourceInput,
  sameOrigin: boolean,
  credentialOrigin: string,
  budget: Budget
): Promise<{ text: string; linkHeader: string | null }> {
  const accept = { Accept: "application/json, text/csv, text/plain;q=0.9, */*;q=0.8" };
  const secret = src.authHeader?.value;
  const credential: Record<string, string> = src.authHeader?.name && secret ? { [src.authHeader.name]: secret } : {};
  let carryCredential = true;

  let target = url;
  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!sameOrigin) await assertFetchable(target);
    if (new URL(target).origin !== credentialOrigin) carryCredential = false;
    const headers = carryCredential ? { ...accept, ...credential } : accept;

    // The timer stays armed until the body has been read, not only until the headers arrive: a
    // server that answers at once and then sends one byte a second held a refresh open for as long
    // as it liked, because `fetch` resolving was the moment the old timer was cleared. It is also
    // never longer than what is left of the whole refresh's budget.
    const remaining = budget.deadline - Date.now();
    if (remaining <= 0) throw new SourceLimitError(SOURCE_TIMED_OUT);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT_MS, remaining));
    try {
      res = await fetch(target, {
        method: src.method ?? "GET",
        headers,
        signal: controller.signal,
        cache: "no-store",
        redirect: "manual",
      });

      const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (location) {
        // A redirect's own body is never read; letting it go frees the connection now.
        await res.body?.cancel().catch(() => {});
        if (hop === MAX_REDIRECTS) throw new Error("Too many redirects");
        target = new URL(location, target).toString();
        // Past the first hop the destination is chosen by the far end, so it is checked even when
        // the source started out as one of this app's own endpoints.
        sameOrigin = false;
        continue;
      }

      const limited = readRateLimit(res.status, res.headers);
      if (limited) throw new RateLimitError(limited);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
      return { text: await readBody(res, budget), linkHeader: res.headers.get("link") };
    } catch (err) {
      if (controller.signal.aborted) throw new SourceLimitError(SOURCE_TIMED_OUT);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("No response");
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
  // Every caller — the data route, the test button, the demo path — comes through here, so the
  // branch lives here too rather than at each of them. A database source has no URL to resolve and
  // nothing below this line applies to it.
  if (isDbType(src.type)) return executeDbSource(src);

  // The guard is skipped only for this deployment's own origin, so the seeded demo sources can be
  // reached over a relative path even when that origin is loopback. Deciding this by
  // `startsWith("/")` was a bypass: `//169.254.169.254/`, `/\169.254.169.254/` and `//evil.com/`
  // all start with a slash yet `new URL()` resolves them to a foreign host — so the guard was
  // skipped for exactly the addresses it exists to block. Resolve first, then trust the fast path
  // only when the *resolved origin* is this deployment's; anything else still clears the guard.
  const base = new URL(origin);
  let resolved: URL;
  try {
    resolved = new URL(src.url, base);
  } catch {
    throw new Error("invalid_url");
  }
  const sameOrigin = resolved.origin === base.origin;
  const startUrl = resolved.toString();
  // The origin the source's credential belongs to: its own URL's, never wherever a response points.
  const credentialOrigin = resolved.origin;
  const budget: Budget = { deadline: Date.now() + TOTAL_BUDGET_MS, bytesLeft: MAX_RESPONSE_BYTES };
  const first = await fetchPage(startUrl, src, sameOrigin, credentialOrigin, budget);
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

  const firstPageRecords = records.length;
  const seen = new Set<string>([startUrl]);
  const all = [...records];

  let page: FetchedPage = { body: parsed.json, linkHeader: first.linkHeader, records: firstPageRecords };
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
    // A next page on another origin is not followed at all. A redirect to a CDN is ordinary HTTP;
    // an API whose pages continue on a different host is not something real APIs do, and the rows
    // already collected are kept and marked partial rather than fetched from somewhere unvetted.
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
    let next: { text: string; linkHeader: string | null };
    try {
      // Paging URLs come from the response body, so they are never treated as same-origin.
      next = await fetchPage(currentUrl, src, false, credentialOrigin, budget);
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
  return tableFromRecords(all, fetchedAt, { pageCount, truncated: truncated || undefined, retryAfterSec });
}
