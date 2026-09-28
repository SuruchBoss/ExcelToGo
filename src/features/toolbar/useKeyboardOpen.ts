// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useState } from "react";

/**
 * Is an on-screen keyboard up? A phone shrinks the visual viewport, not the layout one, when it
 * raises a keyboard, and anything pinned to the bottom then rides up on top of it and eats a third
 * of what is left. While someone is typing into a cell they are not switching panels or copying, so
 * the bars that would ride up go instead.
 */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => setOpen(window.innerHeight - vv.height > 150);
    vv.addEventListener("resize", check);
    return () => vv.removeEventListener("resize", check);
  }, []);
  return open;
}
