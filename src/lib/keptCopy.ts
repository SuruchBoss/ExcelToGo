// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Whether this browser has ever handed a file of the work to the person — an export of any kind.
 *
 * The work lives in this browser only, and the one thing that makes that safe is a copy somewhere
 * else. So the save status on the top bar carries an amber dot until the first copy leaves (#129):
 * a reminder that sits where the save is reported, instead of a three-line banner over the grid.
 *
 * Set from `downloadBlob`, which every export goes through (Excel, CSV, PDF, and the crash rescue),
 * so no export can be added that forgets to clear it. No dependencies, because `download.ts` has
 * none either: the crash path imports it.
 */

const KEY = "exceltogo.copy-kept";
const EVENT = "exceltogo:copy-kept";

export function hasKeptCopy(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    // Nothing can be remembered in this browser, so nothing says a copy was kept. The dot stays —
    // which is right: a browser that refuses storage is the one most likely to lose the work.
    return false;
  }
}

export function markCopyKept() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Not remembered past this page; the event still clears the dot until a reload.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeKeptCopy(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  // Another tab exporting counts too.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
