// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page itself is a client component (it follows the reader's language choice), so its title
// lives here. Thai, like the root layout's, because that is the language a first visit arrives in.
// Its own canonical too (#148): it used to inherit the landing page's, which says "this is a copy
// of /" and can keep the guide out of the index altogether.
export const metadata: Metadata = pageMetadata("guide");

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
