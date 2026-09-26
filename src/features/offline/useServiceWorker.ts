// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, once, and never in development.
 *
 * Not in development because a worker that caches the app shell is precisely what makes a code
 * change appear not to have happened — the loop where you edit, reload, see the old page, and
 * start debugging code that is already correct.
 *
 * Failure is ignored on purpose. A browser with service workers switched off, a page served over
 * plain http, a private window with storage blocked: in all of them the app works exactly as it
 * did before this existed, which is the right outcome for a progressive enhancement.
 */
export function useServiceWorker(): void {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* nothing to do about it, and nothing to tell the user */
    });
  }, []);
}
