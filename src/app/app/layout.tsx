// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page is a client component, so its metadata lives here (#148). Until this file it carried
// the landing page's title and canonical, which told search engines /app was a copy of /.
export const metadata: Metadata = pageMetadata("app");

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
