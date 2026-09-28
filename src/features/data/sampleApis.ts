// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { Locale } from "@/i18n/types";
import type { BrowserSourceDraft } from "@/store/dataSourceStore";

/**
 * Three APIs to try the feature on before connecting a real one (#110 follow-up).
 *
 * Served by this site under `/api/sample/*`, with numbers that move on their own. They are not added
 * for anyone: a sample fills in the same form a real API uses, and the person tests, saves and puts it
 * in the sheet themselves — so trying one is practice for the real thing, not a different path. Each
 * shows one shape an API comes in: a list that changes (sales), a single object of values (today's
 * summary), and a list spread over pages (orders).
 */
export interface SampleApi {
  key: "sales" | "summary" | "orders";
  path: string;
  refreshSec: number;
  maxRows?: number;
}

export const SAMPLE_APIS: SampleApi[] = [
  { key: "sales", path: "/api/sample/sales", refreshSec: 5 },
  { key: "summary", path: "/api/sample/summary", refreshSec: 5 },
  { key: "orders", path: "/api/sample/orders", refreshSec: 30, maxRows: 200 },
];

/** The sample's URL on this site, asking for its words in the language on screen. */
export function sampleUrl(sample: SampleApi, origin: string, locale: Locale): string {
  return `${origin}${sample.path}${locale === "en" ? "?lang=en" : ""}`;
}

/** The form, filled in for a sample — the person still presses Test and Save. */
export function sampleDraft(sample: SampleApi, name: string, origin: string, locale: Locale): BrowserSourceDraft {
  return {
    name,
    type: "rest",
    url: sampleUrl(sample, origin, locale),
    headerName: "",
    jsonPath: "",
    maxRows: sample.maxRows ?? 1000,
    refreshSec: sample.refreshSec,
  };
}
