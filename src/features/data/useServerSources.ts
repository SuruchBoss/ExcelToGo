// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether this deployment offers server-side sources (#109): the root layout marks the page when
 * `SOURCES_ADMIN_TOKEN` is set, per request. Without the mark the whole server half of the panel —
 * token box, list, "add" button — is simply not there, and nothing says it is off.
 */
const read = () => document.documentElement.dataset.serverSources === "1";
const subscribe = () => () => {};

export function serverSourcesOffered(): boolean {
  try {
    return read();
  } catch {
    return false;
  }
}

export function useServerSources(): boolean {
  // False on the server and during hydration, then the real answer: the mark never changes while
  // the page is open, so there is nothing to subscribe to.
  return useSyncExternalStore(subscribe, read, () => false);
}
