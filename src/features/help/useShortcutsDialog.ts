// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Owns whether the shortcut sheet is open, and the key that opens it.
 *
 * `Ctrl/Cmd+/` rather than the `?` that most web apps use: the grid starts editing a cell on any
 * printable character, so `?` typed with the sheet focused — which is nearly always — would land a
 * question mark in a cell instead. `F1` as well, because it costs nothing and it is the key people
 * who want a shortcut list already press.
 *
 * Matched on `code` as well as `key` so a layout that puts `/` somewhere else still works.
 */
export function useShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const slash = (e.ctrlKey || e.metaKey) && (e.key === "/" || e.code === "Slash");
      if (!slash && e.key !== "F1") return;
      e.preventDefault();
      setOpen((wasOpen) => !wasOpen);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { open, setOpen, close };
}
