// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useMemo, useSyncExternalStore } from "react";
import { PERSIST_KEY, RescuedSheet, rescueSheets } from "@/lib/crashRescue";
import { downloadBlob } from "@/lib/download";

/** Nothing writes to storage while a crash screen is up, so there is no change to subscribe to. */
const noSubscribe = () => () => {};

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(PERSIST_KEY);
  } catch {
    // Storage can be unavailable outright — a private window, or a browser configured to block it.
    return null;
  }
}

/** On the server there is no storage to read, and no crash screen to hydrate against either. */
const readOnServer = () => null;

/**
 * Reads the autosaved sheet out of `localStorage` after a crash and hands back one file per tab.
 *
 * Shared by `error.tsx` and `global-error.tsx`. The two screens look nothing alike — one gets the
 * app's stylesheet, the other renders its own document without it — but they must behave the same,
 * and behaviour copied into two files is behaviour that drifts.
 *
 * `useSyncExternalStore` rather than the obvious `useState` + `useEffect`: reading storage in an
 * effect means rendering once with nothing and then setting state, which is both a cascading
 * render the compiler's lint rejects and a flash of "nothing to rescue" on the one screen where
 * that sentence would be alarming. This reads during render, with the server snapshot returning
 * nothing so the markup still matches on hydration.
 */
export function useRescue(): { files: RescuedSheet[]; download: (file: RescuedSheet) => void } {
  const raw = useSyncExternalStore(noSubscribe, readStorage, readOnServer);
  const files = useMemo(() => rescueSheets(raw), [raw]);

  const download = (file: RescuedSheet) => {
    downloadBlob(new Blob([file.csv], { type: "text/csv;charset=utf-8" }), file.filename);
  };

  return { files, download };
}
