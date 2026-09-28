// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { API_ORIGINS_COOKIE, cleanOrigin, connectSrcExtra, MAX_API_ORIGINS, parseApiOrigins, serializeApiOrigins } from "./apiOrigins";
import { proxy } from "@/proxy";

/**
 * The cookie that widens one user's `connect-src` (#110) is input to a security header, so what it
 * may carry is pinned here: exact origins of two shapes, nothing that could widen the policy for
 * everyone, and nothing that could end the directive and start another.
 */
describe("which origins the CSP will take from the cookie", () => {
  it("takes an https origin, with or without a port", () => {
    expect(cleanOrigin("https://a.b")).toBe("https://a.b");
    expect(cleanOrigin("https://a.b:8443")).toBe("https://a.b:8443");
    expect(cleanOrigin("https://api.example.co.th")).toBe("https://api.example.co.th");
  });

  it("takes plain http only on this machine", () => {
    expect(cleanOrigin("http://localhost:3001")).toBe("http://localhost:3001");
    expect(cleanOrigin("http://127.0.0.1:8080")).toBe("http://127.0.0.1:8080");
    expect(cleanOrigin("http://10.0.0.5")).toBeNull();
    expect(cleanOrigin("http://erp.internal")).toBeNull();
  });

  it("refuses anything that would widen the policy for every origin", () => {
    expect(cleanOrigin("https:")).toBeNull();
    expect(cleanOrigin("*")).toBeNull();
    expect(cleanOrigin("https://*")).toBeNull();
    expect(cleanOrigin("https://*.example.com")).toBeNull();
  });

  it("refuses anything that could end the directive or add another", () => {
    expect(cleanOrigin("https://a.b; script-src *")).toBeNull();
    expect(cleanOrigin("https://a.b 'unsafe-inline'")).toBeNull();
    expect(cleanOrigin("https://a.b,https://c.d")).toBeNull();
  });

  it("refuses other schemes, paths, queries and credentials", () => {
    expect(cleanOrigin("javascript:alert(1)")).toBeNull();
    expect(cleanOrigin("data:text/plain,x")).toBeNull();
    expect(cleanOrigin("wss://a.b")).toBeNull();
    expect(cleanOrigin("https://a.b/path")).toBeNull();
    expect(cleanOrigin("https://a.b?x=1")).toBeNull();
    expect(cleanOrigin("https://user:pw@a.b")).toBeNull();
    expect(cleanOrigin("")).toBeNull();
  });

  it("keeps at most twenty, dropping the rest and any bad entry silently", () => {
    const many = Array.from({ length: 21 }, (_, i) => `https://api${i}.example.com`);
    const parsed = parseApiOrigins(serializeApiOrigins(many));
    expect(parsed).toHaveLength(MAX_API_ORIGINS);
    expect(parsed).not.toContain("https://api20.example.com");
    // A hand-written cookie with rubbish in it keeps only what is clean.
    expect(parseApiOrigins(encodeURIComponent("https://a.b|*|https:|https://c.d; script-src *|https://c.d"))).toEqual(["https://a.b", "https://c.d"]);
    expect(parseApiOrigins("%E0%A4%A")).toEqual([]);
  });
});

function served(cookie?: string): string {
  const request = new NextRequest("https://excel-to-go.test/app", {
    headers: cookie === undefined ? {} : { cookie: `${API_ORIGINS_COOKIE}=${cookie}` },
  });
  return proxy(request).headers.get("Content-Security-Policy") ?? "";
}
const connectSrc = (csp: string) => csp.split("; ").find((d) => d.startsWith("connect-src")) ?? "";

describe("the policy the proxy sends", () => {
  it("is unchanged, character for character, for someone who never added a source", () => {
    expect(connectSrc(served())).toBe("connect-src 'self' https://api.anthropic.com");
    expect(connectSrc(served(""))).toBe(connectSrc(served()));
  });

  it("adds exactly the added origin, and nothing else, for someone who did", () => {
    const base = connectSrc(served());
    const withOne = connectSrc(served(serializeApiOrigins(["https://erp.example.com"])));
    expect(withOne).toBe(`${base} https://erp.example.com`);
  });

  it("never lets the cookie add a directive or a wildcard", () => {
    const csp = served(encodeURIComponent("https://a.b; script-src *|*|https:"));
    expect(connectSrc(csp)).toBe("connect-src 'self' https://api.anthropic.com");
    expect(csp.match(/script-src/g)).toHaveLength(1);
    expect(connectSrcExtra(encodeURIComponent("https://a.b|https://a.b"))).toBe("https://a.b");
  });
});
