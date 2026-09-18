"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Owns whether the find panel is open, and the key that opens it.
 *
 * `Ctrl/Cmd+F` rather than a plain `F`, for the same reason the shortcut sheet is not on `?`: the
 * grid starts editing a cell on any printable character, so a bare letter typed with the sheet
 * focused — which is nearly always — lands in a cell instead of opening anything.
 *
 * The browser's own find bar is preempted deliberately. It searches the DOM, and the DOM holds the
 * forty rows the grid has decided to render; on a five-thousand-row sheet it would report "not
 * found" for text that is plainly there, which is worse than not offering it.
 */
export function useFindDialog() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key !== "f" && key !== "h") return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { open, setOpen, close };
}
