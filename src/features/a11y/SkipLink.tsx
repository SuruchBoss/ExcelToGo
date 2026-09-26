// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useT } from "@/i18n";

/**
 * A keyboard-only shortcut past the header/toolbar straight to the page's main content — WCAG's
 * "bypass blocks". Off-screen until it takes focus (the first Tab press), then it lands on screen
 * so a sighted keyboard user can see where they are. Targets `#main-content`, which both pages put
 * on their primary landmark.
 */
export default function SkipLink() {
  const t = useT();
  return (
    <a
      href="#main-content"
      className="sr-only z-50 rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
    >
      {t.app.skipToContent}
    </a>
  );
}
