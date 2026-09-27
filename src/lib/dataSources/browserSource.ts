// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { collectTable, NotATableError, newBudget, PageFetcher, readBody } from "./collect";
import { MAX_ROWS_CEILING, REQUEST_TIMEOUT_MS, SOURCE_TIMED_OUT, SourceLimitError } from "./fetchLimits";
import { DEFAULT_MAX_ROWS } from "./paginate";
import { RateLimitError, readRateLimit } from "./rateLimit";
import type { TableData } from "./types";

/**
 * A live source fetched by the person's own browser (#110).
 *
 * The server-side sources ask *our* server to fetch a URL, which is why they sit behind an operator
 * token and a private-network guard. This path has neither, on purpose: the request goes from the
 * user's own machine to an API the user's own machine can reach — through their VPN, from inside
 * their office, or on the public internet — the way draw.io opens a file. Nothing passes through our
 * server: not the URL, not the header, not a byte of the answer.
 *
 * **`urlGuard` is not used here, deliberately.** It exists so that visitors cannot point *our*
 * server at *our* network (cloud metadata, internal services). Here the network is the user's own,
 * reached with the user's own permissions; an internal address is the whole use case, not an attack
 * on anyone. What stands between a page and an arbitrary origin in this path is the browser itself
 * (CORS, mixed content, private-network rules) and the page's CSP, which lists only the origins this
 * user has added (`src/lib/apiOrigins.ts`).
 */
export interface BrowserSourceConfig {
  id: string;
  name: string;
  type: "rest" | "csv";
  url: string;
  /** The auth header's *name* only. Its value is a secret and lives in `sessionStorage` (`browserSecrets.ts`). */
  headerName?: string;
  jsonPath?: string;
  maxRows?: number;
  refreshSec: number;
  createdAt: string;
}

/** Why a browser fetch failed, as a code the panel turns into a sentence and a checklist. */
export type BrowserFetchCode =
  | "invalid_url"
  /** An `http://` API that is not on this machine: blocked as mixed content from an https page. */
  | "insecure_http"
  /** `fetch` threw: unreachable, refused by CORS, or refused by the browser's private-network rules.
   *  The browser deliberately does not say which, so neither does the app. */
  | "network"
  | "auth"
  | "http"
  | "not_table"
  /** A header value `fetch` cannot send (outside Latin-1); caught before anything is sent. */
  | "bad_header"
  /** The source has a header whose value was forgotten with the last tab (it lives in sessionStorage). */
  | "needs_secret"
  /** The source's origin is not in the CSP this page was served with; one reload adds it. */
  | "needs_reload";

export class BrowserFetchError extends Error {
  constructor(
    readonly code: BrowserFetchCode,
    readonly detail: { status?: number; url?: string; keys?: string[] } = {}
  ) {
    super(code);
    this.name = "BrowserFetchError";
  }
}

const LOOPBACK = new Set(["localhost", "127.0.0.1"]);

/**
 * Whether a URL can be fetched from this page at all, decided before anything is sent.
 *
 * Only `https:`, or `http:` on this very machine — the same two shapes the CSP will accept as an
 * origin. A plain `http://` API on the network is refused by every browser from an https page
 * (mixed content), so saying so up front is the one error here that can be named exactly.
 */
export function checkUrl(raw: string): { ok: true; url: URL } | { ok: false; code: "invalid_url" | "insecure_http" } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, code: "invalid_url" };
  }
  if (url.username || url.password) return { ok: false, code: "invalid_url" };
  if (url.protocol === "https:") return { ok: true, url };
  if (url.protocol === "http:") return LOOPBACK.has(url.hostname) ? { ok: true, url } : { ok: false, code: "insecure_http" };
  return { ok: false, code: "invalid_url" };
}

/**
 * Query parameters that look like a credential. A token in the URL ends up in history, logs and
 * anything the URL is copied into; the form asks for it to be moved into the header instead.
 */
const SECRET_PARAM = /^(token|key|apikey|api_key|api-key|access_token|auth|secret|password|signature|sig)$/i;
export function hasSecretInQuery(raw: string): boolean {
  try {
    return [...new URL(raw.trim()).searchParams.keys()].some((k) => SECRET_PARAM.test(k));
  } catch {
    return false;
  }
}

/** The URL with its query and fragment removed — what an error message may show. */
export function urlForDisplay(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

/** A header name `fetch` will accept: an HTTP token, nothing else. Checked in the form, so a typo is
 *  not reported as "the network failed". */
export const isHeaderName = (name: string) => /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name);

/**
 * A header value `fetch` will send. It must be Latin-1 with no line breaks; anything else — a Thai
 * character, a "…" pasted along with a token — makes `fetch` throw before a request exists, which
 * would otherwise be reported as "cannot reach the API".
 */
export const isHeaderValue = (value: string) => /^[\t\x20-\x7e\x80-\xff]*$/.test(value);

const ACCEPT = "application/json, text/csv, text/plain;q=0.9, */*;q=0.8";

/**
 * Reads the source into a table, from this browser.
 *
 * The same collector as the server (`collect.ts`) — pages, byte and time budget, rate limit and
 * partial tables — with requests made this way: CORS, no cookies (`credentials: "omit"`, so a
 * company's single sign-on cookie is never sent by accident), nothing cached. The header goes only
 * to the source's own origin: `collectTable` never follows a page to another origin, and the check
 * below is a second lock on the same door.
 */
export async function fetchInBrowser(
  cfg: Pick<BrowserSourceConfig, "type" | "url" | "jsonPath" | "headerName" | "maxRows">,
  headerValue: string | undefined,
  fetchImpl: typeof fetch = (...args) => fetch(...args)
): Promise<TableData> {
  const checked = checkUrl(cfg.url);
  if (!checked.ok) throw new BrowserFetchError(checked.code);
  const start = checked.url;
  const credentialOrigin = start.origin;
  const headerName = cfg.headerName?.trim();
  if (headerName && headerValue && !isHeaderValue(headerValue)) throw new BrowserFetchError("bad_header");
  const credential: Record<string, string> = headerName && headerValue ? { [headerName]: headerValue } : {};
  const budget = newBudget();

  const fetchPage: PageFetcher = async (url) => {
    const headers: Record<string, string> = { Accept: ACCEPT, ...(new URL(url).origin === credentialOrigin ? credential : {}) };
    const remaining = budget.deadline - Date.now();
    if (remaining <= 0) throw new SourceLimitError(SOURCE_TIMED_OUT);
    // Armed until the body has been read, as on the server: a reply that trickles in is a timeout too.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT_MS, remaining));
    try {
      let res: Response;
      try {
        res = await fetchImpl(url, {
          headers,
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          redirect: "follow",
          signal: controller.signal,
        });
      } catch {
        if (controller.signal.aborted) throw new SourceLimitError(SOURCE_TIMED_OUT);
        throw new BrowserFetchError("network");
      }
      const limited = readRateLimit(res.status, res.headers);
      if (limited) throw new RateLimitError(limited);
      if (res.status === 401 || res.status === 403) throw new BrowserFetchError("auth", { status: res.status });
      if (!res.ok) throw new BrowserFetchError("http", { status: res.status, url: urlForDisplay(url) });
      return { text: await readBody(res, budget), linkHeader: res.headers.get("link") };
    } catch (err) {
      if (controller.signal.aborted && !(err instanceof BrowserFetchError)) throw new SourceLimitError(SOURCE_TIMED_OUT);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await collectTable({
      type: cfg.type,
      jsonPath: cfg.jsonPath?.trim() || undefined,
      maxRows: Math.min(Math.max(0, cfg.maxRows ?? DEFAULT_MAX_ROWS), MAX_ROWS_CEILING),
      startUrl: start.toString(),
      credentialOrigin,
      budget,
      fetchPage,
    });
  } catch (err) {
    if (err instanceof NotATableError) throw new BrowserFetchError("not_table", { keys: err.keys });
    throw err;
  }
}
