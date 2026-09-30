// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { Locale } from "@/i18n/types";
import { SITE_URL } from "@/lib/site";
import { th } from "@/i18n/th";

/**
 * What a search result says about each page, in one place (#148).
 *
 * The metadata (Thai, what a crawler and a first render get) and the tab title the page switches to
 * once a reader picks English (`localeStore`) read from here, so the two cannot drift apart.
 *
 * The words are the ones people type: "แก้ไฟล์ Excel ออนไลน์ ฟรี", "ไม่ต้องสมัคร", "เปิดบนมือถือ".
 * The AI suggestion is not in them: for a visitor without a key it is a keyword guess (#125), and a
 * result snippet has no room for the limit that has to stand beside that promise.
 *
 * Lengths are asserted in `seo.test.ts`: a title past ~60 characters and a description past ~155
 * are cut off in results, and the part that is cut is usually the part that says what it does. The
 * test counts JavaScript string length, which counts Thai vowel and tone marks as characters. That
 * is stricter than the width a result is cut at, on purpose.
 */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

export type PageKey = "home" | "app" | "guide";

export const TITLES: Record<Locale, Record<PageKey, string>> = {
  th: {
    home: "แก้ไฟล์ Excel (.xlsx) ออนไลน์ฟรี ไม่ต้องสมัคร · ExcelToGo",
    app: "แก้ไฟล์ Excel ออนไลน์ · ExcelToGo",
    guide: "คู่มือต่อข้อมูลของคุณเอง · ExcelToGo",
  },
  en: {
    home: "Edit Excel (.xlsx) files online free, no sign-up · ExcelToGo",
    app: "Edit an Excel file online · ExcelToGo",
    guide: "Connect your own data · ExcelToGo",
  },
};

/** Every claim here is true for a visitor with no account and no key. The formula count is checked
 *  against the palette in the test. */
export const DESCRIPTIONS: Record<Locale, Record<PageKey, string>> = {
  th: {
    home: "แก้ไฟล์ Excel (.xlsx) ออนไลน์ฟรี ไม่ต้องสมัคร ไม่ต้องอัปโหลด เปิดบนมือถือได้ มีสูตรพร้อมใช้ 37 แบบพร้อมคำอธิบายภาษาไทย แล้วส่งออกกลับเป็น .xlsx",
    app: "เปิดไฟล์ .xlsx หรือ CSV แก้ในเบราว์เซอร์ ใส่สูตรจากรายการพร้อมคำอธิบายภาษาไทย แล้วส่งออกกลับเป็น Excel ไม่ต้องสมัคร ไฟล์ไม่ถูกอัปโหลด",
    guide: "ต่อ REST API, CSV, PostgreSQL หรือ MySQL ของคุณเองเข้ากับ ExcelToGo ทีละขั้น พร้อมคำสั่งที่คัดลอกได้",
  },
  en: {
    home: "Edit Excel (.xlsx) files online for free, no sign-up, no upload. Works on a phone, with 37 ready-made formulas explained, and saves back to .xlsx.",
    app: "Open an .xlsx or CSV file, edit it in your browser, add formulas from an explained list, and export back to Excel. No sign-up; the file is not uploaded.",
    guide: "Connect your own REST API, CSV, PostgreSQL or MySQL to ExcelToGo step by step, with commands you can copy.",
  },
};

/** The one address each page answers to. Absolute, so a copy served from a preview URL still
 *  points search engines at the real one. */
export const CANONICAL: Record<PageKey, string> = {
  home: SITE_URL,
  app: `${SITE_URL}/app`,
  guide: `${SITE_URL}/guide`,
};

/** What every page's Open Graph block shares. A page that sets its own `openGraph` replaces the
 *  parent's whole, so each spreads this rather than repeating it. Thai, with English as the
 *  alternate, like the app's own default. */
export const OPEN_GRAPH: { type: "website"; siteName: string; locale: string; alternateLocale: string[] } = {
  type: "website",
  siteName: "ExcelToGo",
  locale: "th_TH",
  alternateLocale: ["en_US"],
};

/**
 * A sub-page's metadata. Everything a page says in a link preview is built here, because Next
 * replaces a parent's `openGraph` and `twitter` blocks whole rather than merging them: a page that
 * set only its own title there lost the card image and fell back to a small card. The images are
 * the root's `opengraph-image` / `twitter-image`, named rather than inherited for that reason.
 */
export function pageMetadata(page: Exclude<PageKey, "home">) {
  const title = TITLES.th[page];
  const description = DESCRIPTIONS.th[page];
  const image = { width: 1200, height: 630, alt: "ExcelToGo" };
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: CANONICAL[page] },
    openGraph: { ...OPEN_GRAPH, url: CANONICAL[page], title, description, images: [{ url: "/opengraph-image", ...image }] },
    twitter: { card: "summary_large_image" as const, title, description, images: [{ url: "/twitter-image", ...image }] },
  };
}

/** The profiles the landing page already links, and the name it shows. `sameAs` may only name
 *  what a reader can see on the page. */
export const MAKER = {
  name: "Suruch Boss",
  sameAs: ["https://github.com/SuruchBoss", "https://www.linkedin.com/in/suruchboss"],
};

/**
 * Structured data for the landing page: what the app is, and who makes it.
 *
 * No `aggregateRating` and no reviews. There are none, and made-up ones are against both Google's
 * rules and this project's.
 */
export function landingJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: "ExcelToGo",
        url: SITE_URL,
        description: DESCRIPTIONS.th.home,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any (web browser)",
        inLanguage: ["th", "en"],
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "THB" },
        author: { "@id": `${SITE_URL}/#maker` },
      },
      {
        "@type": "Person",
        "@id": `${SITE_URL}/#maker`,
        name: MAKER.name,
        sameAs: MAKER.sameAs,
      },
      faqPage(th.landing.faq),
    ],
  };
}

/** How a visible FAQ answer reads as one passage: the answer, then its details. */
export const faqAnswerText = (f: { answer: string; detail: string }) => `${f.answer} ${f.detail}`;

/**
 * The landing page's questions as `FAQPage` data (#152), built from the same entries the page
 * renders, in Thai because that is what a crawler gets. It may never say more than the page does:
 * a test compares the two, and the e2e reads the served page against the served data.
 */
export function faqPage(faq: readonly { q: string; answer: string; detail: string }[]) {
  return {
    "@type": "FAQPage",
    "@id": `${SITE_URL}/#faq`,
    inLanguage: "th",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: faqAnswerText(f) },
    })),
  };
}

/**
 * JSON for a `<script type="application/ld+json">`. `<` is escaped so no string inside it can close
 * the script element early; everything here is ours today, and this keeps it safe if that changes.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
