// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import { connection } from "next/server";
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
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

const DESCRIPTION =
  "พิมพ์ว่าอยากได้อะไรเป็นภาษาไทย แล้วได้สูตร Excel กลับมาพร้อมคำอธิบาย กดปุ่มเดียวใส่ลงเซลล์ — หรือเลือกจากสูตรพร้อมใช้ 32 แบบ แล้วลากเลือกช่วงเซลล์แทนการพิมพ์ที่อยู่ เปิดไฟล์ .xlsx เดิมได้ ไม่ต้องสมัคร ไม่ต้องอัปโหลด";
const TITLE = "ExcelToGo — พิมพ์เป็นภาษาไทย แล้วได้สูตร Excel ที่ใช้ได้จริง";

export const metadata: Metadata = {
  // Absolute URLs in the Open Graph tags need a base, and og:image is resolved against it — without
  // this the preview image comes out with a relative src and no crawler can fetch it.
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · ExcelToGo",
  },
  // This is the line that shows in search results and link previews, so it says what the app does
  // rather than what problem it set out to solve.
  description: DESCRIPTION,
  applicationName: "ExcelToGo",
  authors: [{ name: "Suruch Boss", url: "https://github.com/SuruchBoss" }],
  creator: "Suruch Boss",
  keywords: [
    "Excel",
    "spreadsheet",
    "xlsx",
    "formula",
    "ตารางคำนวณ",
    "สูตร Excel",
    "Next.js",
    "React",
    "TypeScript",
    "open source",
  ],
  // opengraph-image.tsx / twitter-image.tsx supply the image; only the text lives here. Locale is
  // Thai with English as the alternate, matching the app's own default.
  openGraph: {
    type: "website",
    siteName: "ExcelToGo",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    locale: "th_TH",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  alternates: { canonical: SITE_URL },
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
      className={`${plexThai.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
