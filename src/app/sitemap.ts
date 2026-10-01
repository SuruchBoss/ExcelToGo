// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { MetadataRoute } from "next";
import { CANONICAL, FORMULAS_INDEX, lessonCanonical } from "@/lib/seo";
import { LESSONS } from "@/lib/lessons";

/**
 * The public routes: the landing page, the app, the guide to connecting your own data, and the
 * formula pages (#149) — the list and one per lesson, from the lesson list rather than typed out, so
 * a new lesson is in the sitemap the moment it exists. Everything under /api is not a page.
 *
 * Each URL is the page's own canonical, and `check:e2e` fetches every one of them and fails if the
 * page declares anything else (#148). A new page goes here, with its canonical, or it is not found.
 *
 * No `lastModified`: it used to be `new Date()`, stamped fresh on every request, so it changed each
 * crawl and meant nothing. A date that is always "now" is worse than none, because a crawler learns
 * to ignore it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: CANONICAL.home, changeFrequency: "monthly", priority: 1 },
    { url: CANONICAL.app, changeFrequency: "monthly", priority: 0.8 },
    { url: CANONICAL.guide, changeFrequency: "monthly", priority: 0.5 },
    { url: FORMULAS_INDEX.canonical, changeFrequency: "monthly", priority: 0.6 },
    ...LESSONS.map((l) => ({ url: lessonCanonical(l), changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
