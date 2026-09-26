// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { StateStorage } from "zustand/middleware";

/**
 * Whether the last autosave actually reached the browser, and a storage that never throws.
 *
 * Autosave used to hand `localStorage` straight to the persist middleware. A workbook bigger than
 * the quota (~5 MB) made `setItem` throw `QuotaExceededError` on every state change, and nothing
 * caught it: the error escaped from whichever action had just run — export included, because it
 * sets a busy flag and that is a state change too — so the Export button did nothing, and a reload
 * lost the work without a word. Measured on PaynEat ERP's large import template, which needed about
 * 45 million characters.
 *
 * A failed save is now a *state*, not an exception. The workbook stays whole in memory, everything
 * that works on memory keeps working, and the person is told the one thing they need to know: this
 * will not survive a reload unless they export it.
 *
 * The status lives here rather than in the sheet store on purpose. Setting it from inside the
 * store's own save would be another state change, which triggers another save, which fails again.
 */

/** `full`: the quota is exceeded. `blocked`: storage refused for another reason (private mode,
 *  a policy, a browser that disabled it). Both mean the same thing to the person — not saved. */
export type SaveStatus = "ok" | "full" | "blocked";

let status: SaveStatus = "ok";
const listeners = new Set<() => void>();

function setStatus(next: SaveStatus) {
  if (next === status) return;
  status = next;
  for (const listener of listeners) listener();
}

export function getSaveStatus(): SaveStatus {
  return status;
}

export function subscribeSaveStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test seam: the status is module state. */
export function resetSaveStatus() {
  status = "ok";
}

/**
 * Browsers name this three ways: `QuotaExceededError` (the spec, Chromium, Safari), the Firefox-only
 * `NS_ERROR_DOM_QUOTA_REACHED`, and the legacy numeric codes 22 and 1014. Anything else is "blocked".
 */
export function isQuotaError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { name, code } = err as { name?: unknown; code?: unknown };
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22 || code === 1014;
}

/**
 * Wraps a Storage so that none of its calls throw, and reports whether writes are landing.
 *
 * The Storage is passed in already resolved, so that a browser refusing even to hand over
 * `localStorage` still throws where the persist middleware asks for it — which it takes to mean
 * "no storage here" and turns autosave off, exactly as before this existed.
 */
export function guardedStorage(backing: Storage): StateStorage {
  return {
    getItem(name) {
      try {
        return backing.getItem(name);
      } catch {
        // Nothing readable means nothing to restore; the app starts on its default sheet, as it
        // does on a first visit.
        return null;
      }
    },
    setItem(name, value) {
      try {
        backing.setItem(name, value);
        setStatus("ok");
      } catch (err) {
        // The previous save is left where it is. A stale copy is worth more than none, and the
        // notice tells the person that changes since then are only in this tab.
        setStatus(isQuotaError(err) ? "full" : "blocked");
      }
    },
    removeItem(name) {
      try {
        backing.removeItem(name);
      } catch {
        // Nothing to do: if it cannot be removed it cannot be read back either way.
      }
    },
  };
}
