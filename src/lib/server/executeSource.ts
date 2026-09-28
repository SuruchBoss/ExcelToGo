// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { Budget, collectTable, newBudget, readBody } from "@/lib/dataSources/collect";
import { RateLimitError, readRateLimit } from "@/lib/dataSources/rateLimit";
import { DataSourceConfig, isDbType, TableData } from "@/lib/dataSources/types";
import {
  MAX_DELIVERED_BYTES,
  REQUEST_TIMEOUT_MS,
  SOURCE_TIMED_OUT,
  SourceLimitError,
} from "@/lib/dataSources/fetchLimits";
import { executeDbSource } from "./executeDbSource";
import { assertFetchable } from "./urlGuard";

export type SourceInput = Pick<
  DataSourceConfig,
  "type" | "url" | "method" | "authHeader" | "jsonPath" | "maxRows" | "connection" | "query"
>;

/** Redirect hops followed per request, each one re-checked. */
const MAX_REDIRECTS = 5;

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

/**
 * Fetches a source and normalizes whatever it returns into a TableData. Runs on the server so
 * the auth header never reaches the browser and CORS isn't the user's problem. `origin` lets an
 * app-relative URL ("/api/sample/sales") resolve against the current deployment.
 *
 * When the first response looks like a list and signals a next page, following pages are fetched
 * and their records appended, up to `maxRows` (and never more than MAX_PAGES requests or the total
 * time budget). Stopping early sets `truncated` so the UI can say the table is only part of the
 * data — showing a silently partial table is the one outcome worth avoiding here.
 */
export async function executeSource(src: SourceInput, origin: string): Promise<TableData> {
  return fitForDelivery(await collectSource(src, origin));
}

/**
 * The table cut to the rows that fit in `limit` bytes of JSON, as the route will send it (#80).
 *
 * Whole when it fits, which is the usual case and costs one `JSON.stringify` to find out. Otherwise
 * each row is measured once and the table keeps the longest run from the top that fits alongside
 * the columns and the flags — a partial table the panel already knows how to say is partial, rather
 * than a response the platform refuses.
 */
export function fitForDelivery(table: TableData, limit = MAX_DELIVERED_BYTES): TableData {
  if (Buffer.byteLength(JSON.stringify(table)) <= limit) return table;
  const cut: TableData = { ...table, rows: [], truncated: true, sizeLimited: true };
  let used = Buffer.byteLength(JSON.stringify(cut));
  let n = 0;
  for (const row of table.rows) {
    const bytes = Buffer.byteLength(JSON.stringify(row)) + (n > 0 ? 1 : 0); // the comma between rows
    if (used + bytes > limit) break;
    used += bytes;
    n++;
  }
  cut.rows = table.rows.slice(0, n);
  return cut;
}

async function collectSource(src: SourceInput, origin: string): Promise<TableData> {
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
  const budget: Budget = newBudget();
  // Everything between the requests — pages, budget, rate limit, partial tables — is shared with the
  // browser's fetcher in `collect.ts`. What is the server's alone is how each request is made:
  // redirects followed by hand, every destination checked by the private-network guard.
  return collectTable({
    type: src.type,
    jsonPath: src.jsonPath,
    maxRows: src.maxRows,
    startUrl,
    credentialOrigin,
    budget,
    // Paging URLs come from the response body, so only the source's own URL may take the fast path.
    fetchPage: (url, first) => fetchPage(url, src, first && sameOrigin, credentialOrigin, budget),
  });
}
