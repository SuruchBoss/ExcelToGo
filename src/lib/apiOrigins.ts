// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * The origins this browser has added API sources for, as the page's CSP will allow them (#110).
 *
 * `connect-src` is narrow on purpose: the visitor's own Anthropic key sits in `sessionStorage`, and
 * the policy is what stops an injected script from sending it anywhere (see `next.config.ts`). A
 * browser source needs the page to talk to the user's API, so rather than opening `connect-src` for
 * everyone, each user's own origins travel in a first-party cookie and `src/proxy.ts` adds exactly
 * those to *that user's* policy. Someone who never adds a source gets the policy they always had,
 * character for character.
 *
 * The cookie is input to a security header, so everything read from it is re-derived here rather
 * than trusted: parsed with `new URL`, reduced to `.origin`, and dropped silently unless it is
 * exactly an `https://host[:port]` or `http://localhost[:port]` / `http://127.0.0.1[:port]` origin.
 * No wildcard, no scheme source, no path, nothing that could end a directive — the string that goes
 * into the header is one `URL` produced, not one the cookie did.
 */
export const API_ORIGINS_COOKIE = "etg-api-origins";
export const MAX_API_ORIGINS = 20;

const LOOPBACK = new Set(["localhost", "127.0.0.1"]);

/** The origin as the CSP will name it, or null for anything that is not a plain, allowed origin. */
export function cleanOrigin(raw: string): string | null {
  // Characters that have no business in an origin and every business in an attack on the header.
  if (!raw || /[\s;,'"*\\]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const allowed = url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK.has(url.hostname));
  if (!allowed || !url.hostname) return null;
  // Exactly an origin: `https://a.b/path` or `https://a.b?x` is not one, and is not quietly trimmed
  // into one either — a cookie that says something else was not written by this app.
  if (url.origin !== raw) return null;
  return url.origin;
}

/** The cookie's value as a list of clean origins, at most MAX_API_ORIGINS, duplicates removed. */
export function parseApiOrigins(value: string | undefined | null): string[] {
  if (!value) return [];
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const part of decoded.split("|")) {
    const origin = cleanOrigin(part);
    if (origin && !out.includes(origin)) out.push(origin);
    if (out.length === MAX_API_ORIGINS) break;
  }
  return out;
}

/** The cookie value for a list of origins: clean ones only, in order, at most MAX_API_ORIGINS. */
export function serializeApiOrigins(origins: string[]): string {
  const clean: string[] = [];
  for (const o of origins) {
    const c = cleanOrigin(o);
    if (c && !clean.includes(c)) clean.push(c);
    if (clean.length === MAX_API_ORIGINS) break;
  }
  return encodeURIComponent(clean.join("|"));
}

/** What the proxy appends to `connect-src`: the clean origins, space-separated, or "" for none. */
export function connectSrcExtra(cookieValue: string | undefined | null): string {
  return parseApiOrigins(cookieValue).join(" ");
}

/**
 * The origins the *current page* was served with — what its CSP actually allows right now. Read once,
 * at load: a cookie written later only takes effect on the next load, which is exactly the question
 * this answers ("does adding this origin need a reload?").
 */
let atLoad: string[] | null = null;
/** This site itself: always reachable through `'self'`, so never a reason to reload or a cookie entry. */
export function isOwnOrigin(origin: string): boolean {
  try {
    return origin === window.location.origin;
  } catch {
    return false;
  }
}

export function originsAllowedAtLoad(): string[] {
  if (atLoad === null) atLoad = readApiOriginsCookie();
  return atLoad;
}

export function readApiOriginsCookie(): string[] {
  try {
    const hit = document.cookie.split("; ").find((c) => c.startsWith(`${API_ORIGINS_COOKIE}=`));
    return parseApiOrigins(hit ? hit.slice(API_ORIGINS_COOKIE.length + 1) : "");
  } catch {
    return [];
  }
}

/** Writes the list; an empty list removes the cookie. `Secure` is honoured on localhost too. */
export function writeApiOriginsCookie(origins: string[]): void {
  // What this page was served with has to be read before the first write changes the cookie, or a
  // page served with an origin would believe it was not — found by the e2e flow that sets the
  // cookie first and loads second, which is exactly what a reload does.
  originsAllowedAtLoad();
  try {
    const value = serializeApiOrigins(origins);
    document.cookie = value
      ? `${API_ORIGINS_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Strict; Secure`
      : `${API_ORIGINS_COOKIE}=; Path=/; Max-Age=0; SameSite=Strict; Secure`;
  } catch {
    // Cookies blocked: the source will say it needs a reload, and the reload will not help — the
    // panel's message names cookies as the thing to check.
  }
}
