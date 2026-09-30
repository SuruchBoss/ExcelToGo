// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { CANONICAL, DESCRIPTION_MAX, DESCRIPTIONS, MAKER, TITLE_MAX, TITLES, jsonLdScript, landingJsonLd } from "./seo";
import { getFormulaCatalog } from "./formulaCatalog";
import { SITE_URL } from "./site";
import { th } from "@/i18n/th";
import { en } from "@/i18n/en";

const every = <T,>(table: Record<string, Record<string, T>>) =>
  Object.entries(table).flatMap(([locale, pages]) => Object.entries(pages).map(([page, v]) => [`${locale}.${page}`, v] as const));

describe("what a search result says about each page (#148)", () => {
  // One test for the whole table, naming the offender, rather than one per entry: check:readme
  // counts `it(...)` blocks, and a row added to the table should not move the documented count.
  it("every title fits before a result cuts it off", () => {
    const over = every(TITLES).filter(([, title]) => title.length > TITLE_MAX || !title.endsWith("ExcelToGo"));
    expect(over.map(([key, t]) => `${key}: ${t.length}`)).toEqual([]);
  });

  it("every description fits before a result cuts it off", () => {
    const over = every(DESCRIPTIONS).filter(([, d]) => d.length > DESCRIPTION_MAX);
    expect(over.map(([key, d]) => `${key}: ${d.length}`)).toEqual([]);
  });

  it("no two pages share a title, so a result list can tell them apart", () => {
    for (const locale of ["th", "en"] as const) {
      const titles = Object.values(TITLES[locale]);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it("leads with what people search for, in both languages", () => {
    expect(TITLES.th.home).toMatch(/^แก้ไฟล์ Excel/);
    expect(DESCRIPTIONS.th.home).toMatch(/^แก้ไฟล์ Excel \(\.xlsx\) ออนไลน์ฟรี ไม่ต้องสมัคร ไม่ต้องอัปโหลด/);
    expect(TITLES.en.home).toMatch(/^Edit Excel/);
  });

  it("promises nothing about AI, which has a limit a snippet has no room for (#125)", () => {
    for (const [, text] of [...every(TITLES), ...every(DESCRIPTIONS)]) expect(text).not.toMatch(/\bAI\b|เอไอ/);
  });

  it("the formula count it quotes is the palette's", () => {
    const count = String(getFormulaCatalog(th).length);
    expect(DESCRIPTIONS.th.home).toContain(`${count} แบบ`);
    expect(DESCRIPTIONS.en.home).toContain(`${count} ready-made`);
  });

  it("each page's canonical is its own address, never the landing page's for all", () => {
    expect(CANONICAL).toEqual({ home: SITE_URL, app: `${SITE_URL}/app`, guide: `${SITE_URL}/guide` });
  });
});

describe("the landing page's structured data (#148)", () => {
  const ld = landingJsonLd();
  const [app, person] = ld["@graph"];

  it("round-trips through its script text as valid JSON", () => {
    expect(JSON.parse(jsonLdScript(ld))).toEqual(ld);
  });

  it("describes a free web application, in the words the page's own description uses", () => {
    expect(app).toMatchObject({
      "@type": "WebApplication",
      name: "ExcelToGo",
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any (web browser)",
      inLanguage: ["th", "en"],
      offers: { "@type": "Offer", price: "0", priceCurrency: "THB" },
      description: DESCRIPTIONS.th.home,
    });
  });

  it("claims no rating or review, because there are none", () => {
    const text = JSON.stringify(ld);
    expect(text).not.toMatch(/aggregateRating|"review"|ratingValue/);
  });

  it("names the maker as the page shows them, with only the profiles the page links", () => {
    expect(person).toMatchObject({ "@type": "Person", name: MAKER.name });
    expect(MAKER.name).toBe(th.landing.authorName);
    expect(MAKER.name).toBe(en.landing.authorName);
    expect(app.author).toEqual({ "@id": person["@id"] });
  });

  it("cannot close its own script element, whatever a string in it says", () => {
    expect(jsonLdScript({ x: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
