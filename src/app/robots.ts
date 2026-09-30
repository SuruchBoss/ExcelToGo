// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Let crawlers index the pages but keep them out of the API, which returns data, not documents.
 *
 * **Open to AI crawlers on purpose (#148).** GPTBot, ClaudeBot, PerplexityBot, Google-Extended and
 * the rest fall under `*` and are allowed. That is a decision, not something left unhardened: the
 * people this app is for increasingly ask an AI "how do I edit an Excel file without Office", and
 * an answer can only cite a page its crawler was allowed to read. Blocking them would need the
 * owner's say-so, not a tidy-up.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
