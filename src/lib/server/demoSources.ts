// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { DataSourceConfig } from "@/lib/dataSources/types";

/**
 * The only sources a public demo is allowed to read.
 *
 * `SECURITY.md` says why the live-data feature is switched off on a public deployment: the API has
 * no authentication and makes the *server* fetch a URL the caller chose, which on a cloud host
 * reaches instance metadata and internal services. Every word of that is about **a URL the caller
 * chose**. These three are not — they are fixed at build time, app-relative, and answered by this
 * app's own `/api/demo/*` handlers, so on the demo the server's HTTP client has exactly three
 * destinations and no visitor can add a fourth. Writing is still refused outright, which is what
 * keeps that true: with no create, edit or test endpoint there is no way to introduce a URL.
 *
 * Switching the feature off entirely was the safe thing to do while it was the *only* safe thing.
 * It also meant the landing page advertised something the demo could not show, which is its own
 * kind of wrong — so read-only access to a closed set replaces it.
 *
 * They double as the seed for a local install, so a fresh clone has something live in the panel
 * on first run. One list, not two: a second copy would drift, and the copy that drifted would be
 * the one deciding what a public deployment may fetch.
 */
export const DEMO_SOURCES: DataSourceConfig[] = [
  {
    id: "demo-sales",
    name: "ยอดขายสด (ตัวอย่าง)",
    type: "rest",
    url: "/api/demo/sales",
    method: "GET",
    refreshSec: 5,
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "demo-summary",
    name: "สรุปวันนี้ (ตัวอย่าง)",
    type: "rest",
    url: "/api/demo/summary",
    method: "GET",
    refreshSec: 5,
    createdAt: new Date(0).toISOString(),
  },
  {
    // Returns 25 rows per page over 120 rows, so the panel shows a source that only adds up to
    // its full size once pages have been followed.
    id: "demo-orders",
    name: "รายการสั่งซื้อ (ตัวอย่าง, หลายหน้า)",
    type: "rest",
    url: "/api/demo/orders",
    method: "GET",
    maxRows: 200,
    refreshSec: 30,
    createdAt: new Date(0).toISOString(),
  },
];

/**
 * The demo source with this id, or `undefined`.
 *
 * A lookup against the list rather than a "does the id start with demo-" test: the id arrives
 * from the URL, and a prefix check would let `demo-../../something` through to whatever the
 * repository happens to hold.
 */
export function getDemoSource(id: string): DataSourceConfig | undefined {
  return DEMO_SOURCES.find((s) => s.id === id);
}
