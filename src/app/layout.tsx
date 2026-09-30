// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import { serverSourcesConfigured } from "@/lib/demoMode";
import { connection } from "next/server";
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import { CANONICAL, DESCRIPTIONS, MAKER, OPEN_GRAPH, TITLES } from "@/lib/seo";
import "./globals.css";

// Geist was here because create-next-app put it here, and it has no Thai glyphs at all — every
// Thai character in this Thai-first app was silently falling back to whatever the OS offered,
// which is why the same page looked different on Windows and macOS. Plex Sans Thai is drawn as one
// family across both scripts, so a Thai sentence and the English beside it finally share a voice.
//
// The two variables are named for the faces, not for the roles: Tailwind's own theme keys are
// --font-sans and --font-mono, and pointing those at themselves (--font-sans: var(--font-sans))
// left the cascade to decide which definition won. globals.css builds the role stacks out of these.
const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["latin", "thai"],
  // 300 was in this list and nothing used it: the app only reaches for normal, medium, semibold
  // and bold. Each weight is a separate woff2 per subset, and the Thai ones are the heavy files.
  weight: ["400", "500", "600", "700"],
});

// Every number, cell address and formula on the site is set in this: a spreadsheet is a grid, and
// figures that don't line up in a column read as decoration rather than as data.
//
// It carries no Thai at all, so it is never the whole story — see the --font-mono stack in
// globals.css, which hands Thai on to Plex Sans Thai rather than to the system's default.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// What a search result says (#148) comes from `src/lib/seo.ts`, where the tab title the page
// switches to in English also lives. It leads with what people type — edit an Excel file online,
// free, no sign-up — and not with the AI suggestion, which for a visitor without a key is a keyword
// guess (#125).
export const metadata: Metadata = {
  // Absolute URLs in the Open Graph tags need a base, and og:image is resolved against it — without
  // this the preview image comes out with a relative src and no crawler can fetch it.
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLES.th.home,
    template: "%s · ExcelToGo",
  },
  description: DESCRIPTIONS.th.home,
  applicationName: "ExcelToGo",
  authors: [{ name: MAKER.name, url: MAKER.sameAs[0] }],
  creator: MAKER.name,
  // Search engines mostly ignore this tag. It still said "Next.js, React, TypeScript", which nobody
  // looking for a spreadsheet types, so it now says what they do type.
  keywords: ["แก้ไฟล์ Excel ออนไลน์", "Excel ออนไลน์ ฟรี", "เปิดไฟล์ Excel บนมือถือ", "แก้ xlsx", "สูตร Excel", "edit Excel online", "xlsx editor"],
  // opengraph-image.tsx / twitter-image.tsx supply the image; only the text lives here.
  openGraph: { ...OPEN_GRAPH, url: CANONICAL.home, title: TITLES.th.home, description: DESCRIPTIONS.th.home },
  twitter: {
    card: "summary_large_image",
    title: TITLES.th.home,
    description: DESCRIPTIONS.th.home,
  },
  // No canonical here on purpose (#148): set once in the root layout it was inherited by every
  // route, and told search engines that /app and /guide were copies of /. Each page declares its
  // own; `check:e2e` fails if a page in the sitemap does not.

  // Google Search Console ownership check for the production site (#148). Not a secret: the tag is
  // public by design, and it only proves that whoever controls this deployment added it.
  verification: { google: "9qpXdFd3GLA-nMaN6FDWw6AUTZJzvEGa_4SLuZQ8VZw" },
};

/**
 * Rendered per request, on purpose.
 *
 * `connection()` is what turns off prerendering, and it is here rather than on each page because
 * the reason is the same for all of them: `src/proxy.ts` mints a CSP nonce per request, and Next
 * can only stamp that nonce onto its inline scripts while it is rendering *for* a request. A page
 * prerendered at build time has no nonce in it, the browser refuses every script, and the app is a
 * blank document — which is exactly what happened the first time this was tried without this line.
 *
 * The cost was measured before it was accepted; the numbers are in the README.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  return (
    <html
      lang="th"
      // Whether this deployment offers server-side sources at all (#109): only when it set
      // SOURCES_ADMIN_TOKEN. Read per request, because the gates build once and set the token only
      // when they start the server. A boolean, never the token.
      data-server-sources={serverSourcesConfigured() ? "1" : undefined}
      className={`${plexThai.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
