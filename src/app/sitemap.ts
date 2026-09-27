// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Three public routes: the landing page, the app, and the guide to connecting your own data.
 *  Everything under /api is not a page. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE_URL, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/app`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/guide`, lastModified, changeFrequency: "monthly", priority: 0.5 },
  ];
}
