// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useSheetStore } from "@/store/sheetStore";

/**
 * A short screen below the desktop layout: a phone on its side, or a laptop at 200% zoom (#129,
 * UX-13). The same line as the `short:` variant in globals.css, with `max-lg:` beside it — a desktop
 * window dragged short keeps its toolbar, since it has none of the phone's bars to fold.
 *
 * On the layout viewport, which a phone's keyboard leaves alone: typing does not flip the layout.
 */
export const SHORT_SCREEN = "(max-height: 499px) and (max-width: 1023px)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(SHORT_SCREEN);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useShortScreen(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(SHORT_SCREEN).matches, () => false);
}

/**
 * Folds the formatting row away on a short screen, and brings it back as it was on leaving one.
 *
 * It is the least-used bar and 48px of a 390px screen. The brush on the formula bar opens it, as it
 * always has; turning a phone upright gives back whatever it was before.
 */
export function useFormatBarFoldsWhenShort() {
  const short = useShortScreen();
  useEffect(() => {
    const store = useSheetStore.getState();
    if (!short || !store.formatBarOpen) return;
    store.toggleFormatBar();
    return () => {
      if (!useSheetStore.getState().formatBarOpen) useSheetStore.getState().toggleFormatBar();
    };
  }, [short]);
}
