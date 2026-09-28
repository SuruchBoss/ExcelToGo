// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * The value of a browser source's auth header — the one secret this feature holds (#110).
 *
 * `sessionStorage`, keyed by the source's id, and nowhere else: not `localStorage` with the rest of
 * the source's settings, not the workbook, not an exported file, not a crash report and not any
 * request to this app's own `/api/*`. Closing the tab forgets it, and the panel asks for it again
 * the next time the source refreshes. That is the cost, chosen on purpose: a token that outlives the
 * tab is one a shared computer hands to the next person.
 *
 * Every access is wrapped: storage can be blocked outright (a locked-down browser, a private window),
 * and a source that cannot remember its secret should ask for it, not take the panel down.
 */
const PREFIX = "etg-source-header:";

export function readSecret(id: string): string {
  try {
    return window.sessionStorage.getItem(PREFIX + id) ?? "";
  } catch {
    return "";
  }
}

export function writeSecret(id: string, value: string): void {
  try {
    if (value) window.sessionStorage.setItem(PREFIX + id, value);
    else window.sessionStorage.removeItem(PREFIX + id);
  } catch {
    // Blocked storage: the value lasts as long as the form that holds it, and the source asks again.
  }
}

export function forgetSecret(id: string): void {
  writeSecret(id, "");
}
