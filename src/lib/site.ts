// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * The canonical public URL, in one place so metadata, the sitemap and robots.txt cannot disagree.
 * Overridable per deployment; falls back to the Vercel project URL the README points at.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://excel-to-go.vercel.app").replace(/\/$/, "");
