// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import { headers } from "next/headers";
import LandingPage from "@/features/landing/LandingPage";
import { CANONICAL, jsonLdScript, landingJsonLd } from "@/lib/seo";

// The page itself is a client component (it follows the reader's language), so what a crawler
// reads about it lives in this server file: its own canonical (#148), and the structured data.
export const metadata: Metadata = {
  alternates: { canonical: CANONICAL.home },
};

export default async function Home() {
  // Every inline script needs the per-request nonce from `src/proxy.ts`, or the CSP refuses it.
  // This one only describes the page, but a refused script is still a console error on every visit.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        // Our own constant data, serialised with `<` escaped (see jsonLdScript).
        dangerouslySetInnerHTML={{ __html: jsonLdScript(landingJsonLd()) }}
      />
      <LandingPage />
    </>
  );
}
