// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { MetadataRoute } from "next";
import { CANONICAL } from "@/lib/seo";

/**
 * Three public routes: the landing page, the app, and the guide to connecting your own data.
 * Everything under /api is not a page.
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
  ];
}
