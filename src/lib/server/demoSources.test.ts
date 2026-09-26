// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { DEMO_SOURCES, getDemoSource } from "./demoSources";

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
