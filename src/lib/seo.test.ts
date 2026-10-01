// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  CANONICAL,
  DESCRIPTION_MAX,
  DESCRIPTIONS,
  FORMULAS_INDEX,
  MAKER,
  TITLE_MAX,
  TITLES,
  breadcrumbJsonLd,
  faqAnswerText,
  formulasTrail,
  jsonLdScript,
  landingJsonLd,
  lessonCanonical,
  lessonTitle,
} from "./seo";
import { LESSONS } from "./lessons";
import sitemap from "@/app/sitemap";
import { FUNCTIONS } from "./formulaEngine/functions";
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
  const [app, person] = ld["@graph"] as Record<string, unknown>[];

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

describe("the landing page's questions (#152)", () => {
  const faqNode = landingJsonLd()["@graph"].find((n) => n["@type"] === "FAQPage") as {
    mainEntity: { name: string; acceptedAnswer: { text: string } }[];
  };

  it("the FAQPage data says what the page says, word for word, and nothing more", () => {
    expect(faqNode.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(
      th.landing.faq.map((f) => [f.q, faqAnswerText(f)])
    );
  });

  it("asks the same questions in both languages, with the same links", () => {
    expect(en.landing.faq).toHaveLength(th.landing.faq.length);
    expect(en.landing.faq.map((f) => Boolean(f.link))).toEqual(th.landing.faq.map((f) => Boolean(f.link)));
    expect(th.landing.faq).toHaveLength(7);
  });

  it("answers the yes-or-no questions with a yes or a no, in the first words", () => {
    // The last one asks how it differs, which a yes or no cannot answer.
    for (const f of th.landing.faq.slice(0, -1)) expect(f.answer).toMatch(/^(ได้|ไม่|ส่วนใหญ่ไม่)/);
    for (const f of en.landing.faq.slice(0, -1)) expect(f.answer).toMatch(/^(Yes|No|Mostly not)\b/);
  });

  it("compares with Excel and Google Sheets in facts, never in rankings (PO)", () => {
    const all = [...th.landing.faq, ...en.landing.faq].map((f) => `${f.q} ${f.answer} ${f.detail}`).join(" ");
    expect(all).not.toMatch(/ดีกว่า|เร็วกว่า|ง่ายกว่า|better|faster|easier|best/i);
  });

  it("the counts it quotes are the palette's and the engine's", () => {
    const text = [...th.landing.faq, ...en.landing.faq].map((f) => `${f.answer} ${f.detail}`).join(" ");
    expect(text).toContain(String(getFormulaCatalog(th).length));
    expect(text).toContain(`${Object.keys(FUNCTIONS).length})`);
  });

  it("says plainly what an exported file loses", () => {
    const [, , , roundTrip] = th.landing.faq;
    for (const lost of ["รูปภาพ", "กราฟ", "PivotTable", "มาโคร"]) expect(roundTrip.detail).toContain(lost);
  });

  it("never offers Supabase without saying it needs your own server, not this site (PO)", () => {
    // The public site has no cloud button: it only appears where someone runs the app with their own
    // Supabase settings. Read in a search result, "connect your own Supabase" alone promises a button
    // nobody here can find (the #125 rule: no promise without its limit beside it).
    const thTexts = th.landing.faq.map((f) => `${f.answer} ${f.detail}`).filter((t) => t.includes("Supabase"));
    const enTexts = en.landing.faq.map((f) => `${f.answer} ${f.detail}`).filter((t) => t.includes("Supabase"));
    expect(thTexts.length).toBeGreaterThan(0);
    expect(enTexts).toHaveLength(thTexts.length);
    for (const t of thTexts) expect(t).toMatch(/เซิร์ฟเวอร์ของคุณเอง[\s\S]*บนเว็บนี้ยังไม่มี/);
    for (const t of enTexts) expect(t).toMatch(/your own server[\s\S]*not on this site/);
  });
});

describe("what a search result says about each formula page (#149)", () => {
  it("every formula page's title and description fit before a result cuts them off", () => {
    const pages = [
      { key: "formulas", title: FORMULAS_INDEX.title, description: FORMULAS_INDEX.description },
      ...LESSONS.map((l) => ({ key: l.slug, title: lessonTitle(l), description: l.lead })),
    ];
    const over = pages.filter((p) => p.title.length > TITLE_MAX || p.description.length > DESCRIPTION_MAX || !p.title.endsWith("ExcelToGo"));
    expect(over.map((p) => `${p.key}: ${p.title.length}/${p.description.length}`)).toEqual([]);
    const titles = [...Object.values(TITLES.th), ...pages.map((p) => p.title)];
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("names a lesson the way people search for it: สูตร NAME, then what it does", () => {
    for (const l of LESSONS) expect(lessonTitle(l)).toMatch(new RegExp(`^สูตร ${l.id}: `));
  });

  it("the breadcrumb runs home › formulas › the formula, each step its own canonical", () => {
    const sumif = LESSONS.find((l) => l.slug === "sumif")!;
    const ld = breadcrumbJsonLd(formulasTrail(sumif));
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement.map((s) => [s.position, s.name, s.item])).toEqual([
      [1, "หน้าแรก", SITE_URL],
      [2, "สูตร Excel", `${SITE_URL}/formulas`],
      [3, "SUMIF", lessonCanonical(sumif)],
    ]);
    expect(lessonCanonical(sumif)).toBe(`${SITE_URL}/formulas/sumif`);
  });

  it("every formula page is in the sitemap, from the lesson list rather than typed out", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain(FORMULAS_INDEX.canonical);
    for (const l of LESSONS) expect(urls).toContain(lessonCanonical(l));
  });
});
