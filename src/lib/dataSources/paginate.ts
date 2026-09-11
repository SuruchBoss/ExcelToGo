/**
 * Working out where the next page of an API lives, without asking the user.
 *
 * The tech-side form takes a URL and nothing else about paging, so this module reads the signals
 * real APIs already put in their responses and decides on its own. Everything here is pure —
 * given a response's headers and body it returns the next URL or null — so the fetch loop in
 * `server/executeSource.ts` stays a thin walk over these decisions.
 */

/** Never make more than this many requests for one refresh, whatever the API claims. */
export const MAX_PAGES = 20;

/** Rows collected per refresh when a source doesn't say otherwise. */
export const DEFAULT_MAX_ROWS = 1000;

export type PageVia = "link-header" | "next-url" | "cursor" | "page-param" | "offset-param";

export interface NextPage {
  url: string;
  via: PageVia;
}

type Json = unknown;

function isRecord(v: Json): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Parses `<https://…?page=2>; rel="next", <…>; rel="last"` into { next: "…", last: "…" }. */
export function parseLinkHeader(header: string | null | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(",")) {
    const m = /^\s*<([^>]+)>\s*;\s*(.+)$/.exec(part);
    if (!m) continue;
    const rel = /rel\s*=\s*"?([^";]+)"?/i.exec(m[2]);
    if (rel) out[rel[1].trim().toLowerCase()] = m[1].trim();
  }
  return out;
}

/** Body fields that hold a ready-to-fetch URL for the next page, in the order APIs favour them. */
const NEXT_URL_KEYS = ["next", "next_url", "nextUrl", "next_page_url", "nextPageUrl", "nextLink", "@odata.nextLink"];
/** Nested spots that hold the same thing, as dot-paths. */
const NEXT_URL_PATHS = ["links.next", "_links.next", "paging.next", "pagination.next", "meta.next"];

/** Cursor fields → the query param the API expects the cursor back in. */
const CURSOR_KEYS: Record<string, string> = {
  next_cursor: "cursor",
  nextCursor: "cursor",
  cursor: "cursor",
  next_page_token: "page_token",
  nextPageToken: "pageToken",
  continuation_token: "continuation_token",
  scroll_id: "scroll_id",
};

const PAGE_PARAMS = ["page", "page_number", "pageNumber", "pg"];
const OFFSET_PARAMS = ["offset", "skip", "start", "startIndex"];

function getPath(json: Json, path: string): Json {
  let cur: Json = json;
  for (const seg of path.split(".")) {
    if (!isRecord(cur)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

/** A next-link may be a plain string or `{ href }` (HAL-style). Anything else isn't a link. */
function asUrlString(v: Json): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (isRecord(v) && typeof v.href === "string" && v.href.trim()) return v.href.trim();
  return null;
}

/** Walks the known next-link spots. Distinguishes "no such field" from "the field says null",
 *  because the second one is the API explicitly telling us this was the last page. */
function findNextLink(body: Json): { url: string | null; present: boolean } {
  if (!isRecord(body)) return { url: null, present: false };
  for (const key of NEXT_URL_KEYS) {
    if (key in body) return { url: asUrlString(body[key]), present: true };
  }
  for (const path of NEXT_URL_PATHS) {
    const head = path.split(".")[0];
    if (!(head in body)) continue;
    const v = getPath(body, path);
    if (v !== undefined) return { url: asUrlString(v), present: true };
  }
  return { url: null, present: false };
}

function findCursor(body: Json, currentUrl: string): { url: string | null; present: boolean } {
  if (!isRecord(body)) return { url: null, present: false };
  for (const [key, defaultParam] of Object.entries(CURSOR_KEYS)) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (typeof raw !== "string" || !raw.trim()) return { url: null, present: true };
    const u = new URL(currentUrl);
    // If the caller already put one of the cursor params in the URL, that name is authoritative —
    // it's the one the API actually answered to.
    const existing = [...u.searchParams.keys()].find((k) => Object.values(CURSOR_KEYS).includes(k) || k === key);
    u.searchParams.set(existing ?? defaultParam, raw.trim());
    return { url: u.toString(), present: true };
  }
  return { url: null, present: false };
}

/** Bumps a page/offset param the URL already carries. Only ever guesses when the tech-side URL
 *  opted in by including such a param — inventing `?page=2` for an API that doesn't page would
 *  just re-fetch page 1 forever. */
function bumpParam(currentUrl: string, pageRecords: number): NextPage | null {
  const u = new URL(currentUrl);
  for (const name of PAGE_PARAMS) {
    const cur = u.searchParams.get(name);
    if (cur !== null && /^\d+$/.test(cur)) {
      u.searchParams.set(name, String(Number(cur) + 1));
      return { url: u.toString(), via: "page-param" };
    }
  }
  for (const name of OFFSET_PARAMS) {
    const cur = u.searchParams.get(name);
    if (cur !== null && /^\d+$/.test(cur)) {
      u.searchParams.set(name, String(Number(cur) + pageRecords));
      return { url: u.toString(), via: "offset-param" };
    }
  }
  return null;
}

export interface NextPageArgs {
  /** The URL that produced this response (absolute). */
  currentUrl: string;
  /** The response's `Link` header, if any. */
  linkHeader?: string | null;
  /** The parsed response body. */
  body: Json;
  /** How many records this page yielded. */
  pageRecords: number;
  /** Records the first page yielded, used to spot a short final page. */
  firstPageRecords: number;
}

/**
 * Decides where the next page is, or null when this was the last one.
 *
 * Priority runs from most explicit to most inferred: a `Link: rel="next"` header, a next-URL field
 * in the body, a cursor field, then bumping a page/offset param the URL already had. An empty page
 * always ends it, and a next link that resolves to the URL we just fetched is treated as the end
 * rather than a loop.
 */
export function nextPageUrl(args: NextPageArgs): NextPage | null {
  const { currentUrl, linkHeader, body, pageRecords, firstPageRecords } = args;
  if (pageRecords === 0) return null;

  const resolve = (raw: string): string | null => {
    // Only shapes that are actually links. Without this, `new URL()` happily turns a junk value
    // like "no more pages" into a relative path and we'd go fetch it.
    if (!/^(https?:\/\/|[/?])/i.test(raw)) return null;
    try {
      const abs = new URL(raw, currentUrl).toString();
      return abs === currentUrl ? null : abs;
    } catch {
      return null;
    }
  };

  const fromHeader = parseLinkHeader(linkHeader).next;
  if (fromHeader) {
    const url = resolve(fromHeader);
    return url ? { url, via: "link-header" } : null;
  }

  const link = findNextLink(body);
  if (link.present) {
    if (!link.url) return null; // The API said explicitly: no next page.
    const url = resolve(link.url);
    return url ? { url, via: "next-url" } : null;
  }

  const cursor = findCursor(body, currentUrl);
  if (cursor.present) return cursor.url ? { url: cursor.url, via: "cursor" } : null;

  // Nothing in the body says anything about paging. Fall back to bumping a param the URL already
  // has — but only while pages come back full, since a short page is how such APIs signal the end.
  if (firstPageRecords > 0 && pageRecords < firstPageRecords) return null;
  return bumpParam(currentUrl, pageRecords);
}
