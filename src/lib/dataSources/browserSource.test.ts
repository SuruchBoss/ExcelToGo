// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { BrowserFetchError, checkUrl, fetchInBrowser, hasSecretInQuery, isHeaderName, isHeaderValue, urlForDisplay } from "./browserSource";
import { RateLimitError } from "./rateLimit";

/**
 * A source fetched by the user's own browser (#110), with `fetch` replaced by a recorder so each
 * request can be inspected: where it went, with which header, and with which options.
 */
interface Call {
  url: string;
  headers: Record<string, string>;
  init: RequestInit;
}
function recorder(routes: Record<string, { body?: string; status?: number; headers?: Record<string, string> } | "throw">) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, headers: { ...(init.headers as Record<string, string>) }, init });
    const route = routes[url];
    if (!route) throw new Error(`unexpected fetch: ${url}`);
    if (route === "throw") throw new TypeError("Failed to fetch");
    return new Response(route.body ?? "", { status: route.status ?? 200, headers: route.headers });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const SOURCE = { type: "rest" as const, url: "https://erp.example.com/items", headerName: "Authorization" };

describe("fetching an API from this browser (#110)", () => {
  it("reads the rows, sending the header, with no cookies and nothing cached", async () => {
    const { calls, fetchImpl } = recorder({
      "https://erp.example.com/items": { body: JSON.stringify({ data: [{ sku: "A", qty: 2 }, { sku: "B", qty: 5 }] }) },
    });
    const table = await fetchInBrowser({ ...SOURCE, jsonPath: "data" }, "Bearer s3cret", fetchImpl);
    expect(table.rows).toEqual([["A", 2], ["B", 5]]);
    expect(calls[0].headers.Authorization).toBe("Bearer s3cret");
    expect(calls[0].init).toMatchObject({ mode: "cors", credentials: "omit", cache: "no-store", redirect: "follow" });
  });

  it("follows the next page on the same origin, and never to another one — nor sends the header there", async () => {
    const { calls, fetchImpl } = recorder({
      "https://erp.example.com/items": { body: JSON.stringify({ data: [{ n: 1 }], next: "https://erp.example.com/items?page=2" }) },
      "https://erp.example.com/items?page=2": { body: JSON.stringify({ data: [{ n: 2 }], next: "https://elsewhere.example.net/items?page=3" }) },
    });
    const table = await fetchInBrowser({ ...SOURCE, jsonPath: "data" }, "Bearer s3cret", fetchImpl);
    expect(table.rows).toEqual([[1], [2]]);
    expect(table.truncated).toBe(true);
    expect(calls.map((c) => c.url)).toEqual(["https://erp.example.com/items", "https://erp.example.com/items?page=2"]);
    expect(calls.every((c) => !c.url.includes("elsewhere"))).toBe(true);
  });

  it("reads CSV as well as JSON", async () => {
    const { fetchImpl } = recorder({ "https://files.example.com/stock.csv": { body: "sku,qty\nA,2\nB,5\n" } });
    const table = await fetchInBrowser({ type: "csv", url: "https://files.example.com/stock.csv" }, undefined, fetchImpl);
    expect(table.rows).toHaveLength(2);
  });

  it("refuses a plain http API on the network before sending anything, and allows it on this machine", async () => {
    const { calls, fetchImpl } = recorder({});
    const err = await fetchInBrowser({ type: "rest", url: "http://10.0.0.5/api" }, undefined, fetchImpl).catch((e) => e);
    expect(err).toBeInstanceOf(BrowserFetchError);
    expect(err.code).toBe("insecure_http");
    expect(calls).toHaveLength(0);
    expect(checkUrl("http://localhost:3001/x").ok).toBe(true);
    expect(checkUrl("ftp://a.b/x")).toEqual({ ok: false, code: "invalid_url" });
    expect(checkUrl("https://user:pw@a.b/x")).toEqual({ ok: false, code: "invalid_url" });
  });

  it("names what it can tell apart: unreachable/CORS, refused credentials, a status, not a table", async () => {
    const code = (p: Promise<unknown>): Promise<BrowserFetchError> => p.then(() => { throw new Error("resolved"); }).catch((e) => e as BrowserFetchError);
    const { fetchImpl } = recorder({
      "https://down.example.com/": "throw",
      "https://auth.example.com/": { status: 401 },
      "https://gone.example.com/x?token=abc": { status: 404 },
      "https://html.example.com/": { body: "<html>hello</html>" },
      "https://obj.example.com/": { body: JSON.stringify({ result: { items: [] }, meta: 1 }) },
      "https://busy.example.com/": { status: 429, headers: { "retry-after": "30" } },
    });
    expect((await code(fetchInBrowser({ type: "rest", url: "https://down.example.com/" }, undefined, fetchImpl))).code).toBe("network");
    expect((await code(fetchInBrowser({ type: "rest", url: "https://auth.example.com/" }, undefined, fetchImpl))).code).toBe("auth");
    const gone = await code(fetchInBrowser({ type: "rest", url: "https://gone.example.com/x?token=abc" }, undefined, fetchImpl));
    // The URL an error shows has no query — a token in it would otherwise end up on screen.
    expect(gone.detail).toEqual({ status: 404, url: "https://gone.example.com/x" });
    expect((await code(fetchInBrowser({ type: "rest", url: "https://html.example.com/" }, undefined, fetchImpl))).code).toBe("not_table");
    const notFound = await code(fetchInBrowser({ type: "rest", url: "https://obj.example.com/", jsonPath: "data" }, undefined, fetchImpl));
    expect(notFound.detail.keys).toEqual(["result", "meta"]);
    expect(await fetchInBrowser({ type: "rest", url: "https://busy.example.com/" }, undefined, fetchImpl).catch((e) => e)).toBeInstanceOf(RateLimitError);
  });

  it("an empty page is a table with no rows, and two empty lists are a question it will not guess (#65)", async () => {
    const { fetchImpl } = recorder({
      "https://erp.example.com/empty": { body: JSON.stringify({ ok: true, page: 99, total: 120, items: [], next: null }) },
      "https://erp.example.com/two": { body: JSON.stringify({ ok: true, orders: [], refunds: [] }) },
    });
    const empty = await fetchInBrowser({ type: "rest", url: "https://erp.example.com/empty" }, undefined, fetchImpl);
    expect(empty.rows).toEqual([]);
    const two = await fetchInBrowser({ type: "rest", url: "https://erp.example.com/two" }, undefined, fetchImpl).catch((e) => e);
    expect(two).toBeInstanceOf(BrowserFetchError);
    expect(two.code).toBe("not_table");
    expect(two.detail.keys).toEqual(["ok", "orders", "refunds"]);
  });

  it("sends no header at all when the source has none", async () => {
    const { calls, fetchImpl } = recorder({ "https://open.example.com/": { body: "[]" } });
    await fetchInBrowser({ type: "rest", url: "https://open.example.com/", headerName: "Authorization" }, undefined, fetchImpl);
    expect(Object.keys(calls[0].headers)).toEqual(["Accept"]);
  });
});

describe("what the form checks before a source is saved", () => {
  it("spots a credential in the query string", () => {
    expect(hasSecretInQuery("https://a.b/x?token=1")).toBe(true);
    expect(hasSecretInQuery("https://a.b/x?API_KEY=1")).toBe(true);
    expect(hasSecretInQuery("https://a.b/x?access_token=1&page=2")).toBe(true);
    expect(hasSecretInQuery("https://a.b/x?page=2&keyword=rice")).toBe(false);
  });

  it("refuses a header value fetch cannot send, instead of calling it a network failure", async () => {
    const { calls, fetchImpl } = recorder({});
    const err = await fetchInBrowser(SOURCE, "Bearer 3f9c…", fetchImpl).catch((e) => e);
    expect(err.code).toBe("bad_header");
    expect(calls).toHaveLength(0);
    expect(isHeaderValue("Bearer abc.DEF-123_=")).toBe(true);
    expect(isHeaderValue("โทเคน")).toBe(false);
    expect(isHeaderValue("a\nb")).toBe(false);
  });

  it("takes only a real header name, and shows URLs without their query", () => {
    expect(isHeaderName("Authorization")).toBe(true);
    expect(isHeaderName("X-API-Key")).toBe(true);
    expect(isHeaderName("Bad Header")).toBe(false);
    expect(isHeaderName("a:b")).toBe(false);
    expect(urlForDisplay("https://a.b/x?token=1#f")).toBe("https://a.b/x");
  });
});
