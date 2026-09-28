// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { isOwnOrigin, originsAllowedAtLoad, readApiOriginsCookie, writeApiOriginsCookie } from "@/lib/apiOrigins";
import { getSaveStatus } from "@/lib/saveHealth";
import type { BrowserSourceDraft } from "@/store/dataSourceStore";

/**
 * The one reload a new API origin costs (#110).
 *
 * The page's CSP is fixed when the page is served, and it lists only the origins this browser had
 * added by then (`src/lib/apiOrigins.ts`). A new origin goes into the cookie at once, but the page
 * can only reach it after the next load. So the form reloads the page for the person, once per
 * origin, and picks up where it was: a test that was about to run runs, a source that was just saved
 * goes into the sheet.
 *
 * Reloading must never cost work. The sheet saves on every change, synchronously; if the last save
 * was refused (a full or blocked `localStorage`), reloading would throw away whatever is only in
 * memory, so it does not happen and the person is told to export first.
 */
const PENDING_KEY = "etg-pending-source";

export type PendingSource =
  /** Resume the form and run its test. The header value rides along in sessionStorage — where it
   *  lives anyway — and is removed the moment it is read back. */
  | { action: "test"; draft: BrowserSourceDraft; headerValue: string; id?: string }
  /** The source is saved; open the picker to put it in the sheet. */
  | { action: "insert"; sourceId: string };

export const originOf = (url: string): string => {
  try {
    return new URL(url.trim()).origin;
  } catch {
    return "";
  }
};

export const hostOf = (url: string): string => {
  try {
    return new URL(url.trim()).host;
  } catch {
    return url;
  }
};

/** Whether this page's CSP was served without the URL's origin, so reaching it takes a reload. */
export function needsReload(url: string): boolean {
  const origin = originOf(url);
  return origin !== "" && !isOwnOrigin(origin) && !originsAllowedAtLoad().includes(origin);
}

/** Adds the origin to the cookie, remembers what to resume, and reloads. False when it may not. */
export function reloadToAllow(url: string, pending?: PendingSource): boolean {
  if (getSaveStatus() !== "ok") return false;
  const origin = originOf(url);
  writeApiOriginsCookie([...readApiOriginsCookie(), origin]);
  try {
    if (pending) window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Without sessionStorage the reload still allows the origin; the form just does not reopen.
  }
  window.location.reload();
  return true;
}

/** What to resume after the reload, read once and removed. */
export function takePending(): PendingSource | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    window.sessionStorage.removeItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingSource) : null;
  } catch {
    return null;
  }
}

/** The origin a pending test is for, without taking it — so loading sources does not drop it from the cookie. */
export function pendingOrigin(): string | undefined {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    const pending = raw ? (JSON.parse(raw) as PendingSource) : null;
    return pending?.action === "test" ? originOf(pending.draft.url) || undefined : undefined;
  } catch {
    return undefined;
  }
}
