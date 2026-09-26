// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { DEMO_SOURCES, demoLanguage, demoUrlIn, getDemoSource, withDemoName } from "./demoSources";
import { GET as sales } from "@/app/api/demo/sales/route";
import { GET as orders } from "@/app/api/demo/orders/route";
import { GET as summary } from "@/app/api/demo/summary/route";

/**
 * These are the sources a public demo will let an anonymous visitor make the server fetch.
 *
 * The whole argument for allowing that is "the visitor picks an id, never a destination", so what
 * is tested here is the shape of the list itself. A source whose URL pointed anywhere else, or an
 * id lookup that matched more than the exact string, would quietly turn the demo back into the
 * SSRF surface that switching the feature off was avoiding.
 */
describe("demo sources", () => {
  it("are app-relative, never absolute", () => {
    for (const s of DEMO_SOURCES) expect(s.url.startsWith("/api/demo/")).toBe(true);
  });

  it("cannot be talked into a protocol-relative host", () => {
    // `//169.254.169.254/` also starts with "/" — the exact trick that got through an earlier
    // guard in this repo, so the check above is not enough on its own.
    for (const s of DEMO_SOURCES) expect(s.url.startsWith("//")).toBe(false);
  });

  it("carry no credential to leak", () => {
    for (const s of DEMO_SOURCES) expect(s.authHeader).toBeUndefined();
  });

  it("only ever read", () => {
    for (const s of DEMO_SOURCES) expect(s.method ?? "GET").toBe("GET");
  });

  it("have unique ids", () => {
    expect(new Set(DEMO_SOURCES.map((s) => s.id)).size).toBe(DEMO_SOURCES.length);
  });

  it("resolves an id that is in the list", () => {
    expect(getDemoSource("demo-sales")?.url).toBe("/api/demo/sales");
  });

  it("refuses an id that is not", () => {
    expect(getDemoSource("src-1234-abcd")).toBeUndefined();
  });

  it("matches the whole id, not a prefix", () => {
    // A `startsWith("demo-")` test would have accepted both of these.
    expect(getDemoSource("demo-sales-evil")).toBeUndefined();
    expect(getDemoSource("demo-../../../etc/passwd")).toBeUndefined();
  });

  it("is case-sensitive", () => {
    expect(getDemoSource("DEMO-SALES")).toBeUndefined();
  });
});

/**
 * The built-ins answer in the language on screen. What matters for safety is that asking in
 * English cannot widen what the demo will fetch: one of two fixed suffixes, on one of three fixed
 * paths, and anything else handed back exactly as it came.
 */
describe("in the language on screen", () => {
  const THAI = /[\u0E00-\u0E7F]/;
  const ask = (url: string) => new Request(`http://localhost${url}`);

  it("reads only the two languages there are", () => {
    expect(demoLanguage("en")).toBe("en");
    for (const v of ["th", null, undefined, "", "EN", "fr", "en&x=1"]) expect(demoLanguage(v)).toBe("th");
  });

  it("asks a built-in for English, and leaves every other URL alone", () => {
    expect(demoUrlIn("/api/demo/sales", "en")).toBe("/api/demo/sales?lang=en");
    expect(demoUrlIn("/api/demo/sales", "th")).toBe("/api/demo/sales");
    for (const other of ["https://api.example.com/sales", "/api/demo/sales/../../x", "//169.254.169.254/"]) {
      expect(demoUrlIn(other, "en")).toBe(other);
    }
  });

  it("shows a built-in's name in the language, but never renames an operator's source", () => {
    const seeded = { id: "demo-sales", name: DEMO_SOURCES[0].name };
    expect(withDemoName(seeded, "en").name).toBe("Live sales (sample)");
    expect(withDemoName(withDemoName(seeded, "en"), "th").name).toBe(DEMO_SOURCES[0].name);
    const renamed = { id: "demo-sales", name: "สาขาสยาม" };
    expect(withDemoName(renamed, "en")).toBe(renamed);
  });

  it("returns the same products either way — only the words change", async () => {
    const th = (await (await sales(ask("/api/demo/sales"))).json()).data.items;
    const en = (await (await sales(ask("/api/demo/sales?lang=en"))).json()).data.items;
    expect(en.map((r: { sku: string }) => r.sku)).toEqual(th.map((r: { sku: string }) => r.sku));
    expect(en.map((r: { price: number }) => r.price)).toEqual(th.map((r: { price: number }) => r.price));
    expect(JSON.stringify(th)).toMatch(THAI);
    expect(JSON.stringify(en)).not.toMatch(THAI);
  });

  it("keeps asking in English on the next page, so a table does not switch halfway down", async () => {
    const first = await (await orders(ask("/api/demo/orders?lang=en"))).json();
    expect(first.next).toBe("/api/demo/orders?page=2&lang=en");
    expect(JSON.stringify(first.items)).not.toMatch(THAI);
    const second = await (await orders(ask(first.next))).json();
    expect(JSON.stringify(second.items)).not.toMatch(THAI);
  });

  it("answers the summary in English too", async () => {
    expect((await (await summary(ask("/api/demo/summary?lang=en"))).json()).top_product).not.toMatch(THAI);
    expect((await (await summary(ask("/api/demo/summary"))).json()).top_product).toMatch(THAI);
  });
});
