// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * What a modal dialog owes the keyboard: Escape closes it, Tab stays inside it, focus goes in when
 * it opens and back to whatever opened it when it closes.
 *
 * Written once because it had been written per dialog, and the two live-data dialogs were written
 * without it — Escape did nothing there while every other window in the app closed on it, found when
 * checking the tablet layout after #110. The listener is on `window` in the capture phase so the
 * grid, which also listens for Escape, never sees the key first.
 *
 * `initial` picks what takes focus; left out, it is the first field or button in the dialog.
 */
export function useDialogKeys(
  panel: RefObject<HTMLElement | null>,
  onClose: () => void,
  initial?: RefObject<HTMLElement | null>
) {
  // The latest onClose without re-running the focus effect: a parent that passes an inline arrow
  // would otherwise hand focus back and forth on every render.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    (initial?.current ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    return () => opener?.focus?.();
    // Only on open and close: the refs are stable and the dialog's own content decides the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const stops = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const inside = panel.current.contains(document.activeElement);
      if (!inside || (!e.shiftKey && document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [panel]);
}
