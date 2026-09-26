// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from "vitest";

// The URL guard resolves hostnames for real, and api.test doesn't exist. Pointing DNS at a public
// address keeps the guard switched on for these tests — which matters, because a guard that is
// mocked away here would be untested on the path that actually uses it.
vi.mock("dns", () => ({ promises: { lookup: async () => [{ address: "93.184.216.34", family: 4 }] } }));

import { MAX_PAGES } from "@/lib/dataSources/paginate";
import { RateLimitError } from "@/lib/dataSources/rateLimit";
import { executeSource } from "./executeSource";

const ORIGIN = "https://app.test";

interface Stub {
  body: unknown | string;
  link?: string;
  status?: number;
  headers?: Record<string, string>;
}

/** Serves canned responses by URL and records the order they were asked for. */
function stubFetch(routes: Record<string, Stub>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url);
    const stub = routes[url];
    if (!stub) throw new Error(`unexpected fetch: ${url}`);
    const headers = new Headers({ ...(stub.link ? { link: stub.link } : {}), ...(stub.headers ?? {}) });
    return {
      ok: (stub.status ?? 200) < 400,
      status: stub.status ?? 200,
      statusText: "",
      headers,
      text: async () => (typeof stub.body === "string" ? stub.body : JSON.stringify(stub.body)),
    } as unknown as Response;
  });
  return calls;
}

function rows(from: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: from + i, name: `row ${from + i}` }));
}

afterEach(() => vi.unstubAllGlobals());

describe("executeSource pagination", () => {
  it("follows next links until the API says there are no more", async () => {
    const calls = stubFetch({
      "https://api.test/orders": { body: { items: rows(1, 3), next: "https://api.test/orders?page=2" } },
      "https://api.test/orders?page=2": { body: { items: rows(4, 3), next: "https://api.test/orders?page=3" } },
      "https://api.test/orders?page=3": { body: { items: rows(7, 2), next: null } },
    });
    const table = await executeSource({ type: "rest", url: "https://api.test/orders" }, ORIGIN);

    expect(table.rows).toHaveLength(8);
    expect(table.pageCount).toBe(3);
    expect(table.truncated).toBeUndefined();
    expect(calls).toHaveLength(3);
  });

  it("follows a Link header", async () => {
    stubFetch({
      "https://api.test/c": { body: rows(1, 2), link: '<https://api.test/c?page=2>; rel="next"' },
      "https://api.test/c?page=2": { body: rows(3, 2) },
    });
    const table = await executeSource({ type: "rest", url: "https://api.test/c" }, ORIGIN);
    expect(table.rows).toHaveLength(4);
  });

  it("stops at maxRows and says the table is only part of the data", async () => {
    stubFetch({
      "https://api.test/o": { body: { items: rows(1, 3), next: "https://api.test/o?page=2" } },
      "https://api.test/o?page=2": { body: { items: rows(4, 3), next: "https://api.test/o?page=3" } },
      "https://api.test/o?page=3": { body: { items: rows(7, 3), next: null } },
    });
    const table = await executeSource({ type: "rest", url: "https://api.test/o", maxRows: 5 }, ORIGIN);

    expect(table.rows).toHaveLength(5);
    expect(table.truncated).toBe(true);
  });

  it("flags truncation even when it stops on exactly maxRows with pages left", async () => {
    stubFetch({
      "https://api.test/x": { body: { items: rows(1, 4), next: "https://api.test/x?page=2" } },
      "https://api.test/x?page=2": { body: { items: rows(5, 4), next: null } },
    });
    const table = await executeSource({ type: "rest", url: "https://api.test/x", maxRows: 4 }, ORIGIN);

    expect(table.rows).toHaveLength(4);
    expect(table.truncated).toBe(true);
  });

  it("fetches only the first response when maxRows is 0", async () => {
    const calls = stubFetch({
      "https://api.test/o": { body: { items: rows(1, 3), next: "https://api.test/o?page=2" } },
    });
    const table = await executeSource({ type: "rest", url: "https://api.test/o", maxRows: 0 }, ORIGIN);

    expect(table.rows).toHaveLength(3);
    expect(calls).toEqual(["https://api.test/o"]);
  });

  it("refuses to make more than MAX_PAGES requests, however long the chain claims to be", async () => {
    const routes: Record<string, Stub> = {};
    for (let i = 1; i <= MAX_PAGES + 10; i++) {
      routes[`https://api.test/e?page=${i}`] = { body: { items: rows(i, 1), next: `https://api.test/e?page=${i + 1}` } };
    }
    const calls = stubFetch(routes);
    const table = await executeSource({ type: "rest", url: "https://api.test/e?page=1", maxRows: 10_000 }, ORIGIN);

    expect(calls).toHaveLength(MAX_PAGES);
    expect(table.truncated).toBe(true);
  });

  it("stops instead of looping when a next link repeats a page already fetched", async () => {
    const calls = stubFetch({
      "https://api.test/loop": { body: { items: rows(1, 2), next: "https://api.test/loop?p=2" } },
      "https://api.test/loop?p=2": { body: { items: rows(3, 2), next: "https://api.test/loop" } },
    });
    const table = await executeSource({ type: "rest", url: "https://api.test/loop" }, ORIGIN);

    expect(calls).toHaveLength(2);
    expect(table.rows).toHaveLength(4);
    expect(table.truncated).toBe(true);
  });

  it("keeps the rows it already has when a later page fails", async () => {
    stubFetch({
      "https://api.test/p": { body: { items: rows(1, 3), next: "https://api.test/p?page=2" } },
      "https://api.test/p?page=2": { body: {}, status: 500 },
    });
    const table = await executeSource({ type: "rest", url: "https://api.test/p" }, ORIGIN);

    expect(table.rows).toHaveLength(3);
    expect(table.truncated).toBe(true);
  });

  it("still throws when the very first request fails", async () => {
    stubFetch({ "https://api.test/dead": { body: {}, status: 503 } });
    await expect(executeSource({ type: "rest", url: "https://api.test/dead" }, ORIGIN)).rejects.toThrow(/503/);
  });

  it("unions columns across pages that don't all carry the same fields", async () => {
    stubFetch({
      "https://api.test/u": { body: { items: [{ a: 1 }], next: "https://api.test/u?page=2" } },
      "https://api.test/u?page=2": { body: { items: [{ a: 2, b: 3 }], next: null } },
    });
    const table = await executeSource({ type: "rest", url: "https://api.test/u" }, ORIGIN);

    expect(table.columns.map((c) => c.key)).toEqual(["a", "b"]);
    expect(table.rows).toEqual([
      [1, null],
      [2, 3],
    ]);
  });

  it("doesn't page a single-object (KPI) response", async () => {
    const calls = stubFetch({ "https://api.test/kpi": { body: { total: 10, orders: 2, next: "https://api.test/kpi?p=2" } } });
    const table = await executeSource({ type: "rest", url: "https://api.test/kpi" }, ORIGIN);

    expect(calls).toHaveLength(1);
    expect(table.rows).toHaveLength(1);
  });

  it("applies jsonPath to every page, not just the first", async () => {
    stubFetch({
      "https://api.test/d": { body: { data: { list: rows(1, 2) }, next: "https://api.test/d?page=2" } },
      "https://api.test/d?page=2": { body: { data: { list: rows(3, 2) }, next: null } },
    });
    const table = await executeSource({ type: "rest", url: "https://api.test/d", jsonPath: "data.list" }, ORIGIN);

    expect(table.rows).toHaveLength(4);
  });

  it("sends the auth header on every page and never in the returned table", async () => {
    const seen: Array<Record<string, string>> = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      seen.push(init.headers as Record<string, string>);
      const last = url.includes("page=2");
      return {
        ok: true,
        status: 200,
        statusText: "",
        headers: new Headers(),
        text: async () => JSON.stringify({ items: rows(1, 2), next: last ? null : "https://api.test/a?page=2" }),
      } as unknown as Response;
    });
    await executeSource(
      { type: "rest", url: "https://api.test/a", authHeader: { name: "Authorization", value: "Bearer s3cret" } },
      ORIGIN
    );

    expect(seen).toHaveLength(2);
    expect(seen.every((h) => h.Authorization === "Bearer s3cret")).toBe(true);
  });

  it("resolves an app-relative URL against the origin", async () => {
    const calls = stubFetch({ "https://app.test/api/demo/sales": { body: rows(1, 2) } });
    await executeSource({ type: "rest", url: "/api/demo/sales" }, ORIGIN);
    expect(calls).toEqual(["https://app.test/api/demo/sales"]);
  });

  it("treats a CSV source as a single page", async () => {
    const calls = stubFetch({ "https://api.test/f.csv": { body: "a,b\n1,2\n3,4\n" } });
    const table = await executeSource({ type: "csv", url: "https://api.test/f.csv" }, ORIGIN);

    expect(calls).toHaveLength(1);
    expect(table.rows).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});

describe("executeSource rate limiting", () => {
  it("raises a typed error carrying the wait when the first request is rate limited", async () => {
    stubFetch({ "https://api.test/r": { body: {}, status: 429, headers: { "retry-after": "45" } } });
    await expect(executeSource({ type: "rest", url: "https://api.test/r" }, ORIGIN)).rejects.toMatchObject({
      name: "RateLimitError",
      retryAfterSec: 45,
    });
  });

  it("reads a 403 as rate limiting only when the quota header says it's spent", async () => {
    stubFetch({ "https://api.test/q": { body: {}, status: 403, headers: { "x-ratelimit-remaining": "0", "retry-after": "30" } } });
    await expect(executeSource({ type: "rest", url: "https://api.test/q" }, ORIGIN)).rejects.toBeInstanceOf(RateLimitError);

    vi.unstubAllGlobals();
    stubFetch({ "https://api.test/f": { body: {}, status: 403 } });
    const plain = executeSource({ type: "rest", url: "https://api.test/f" }, ORIGIN);
    await expect(plain).rejects.toThrow(/403/);
    await expect(plain).rejects.not.toBeInstanceOf(RateLimitError);
  });

  it("keeps the pages it already fetched and passes the wait along", async () => {
    stubFetch({
      "https://api.test/m": { body: { items: rows(1, 3), next: "https://api.test/m?page=2" } },
      "https://api.test/m?page=2": { body: {}, status: 429, headers: { "retry-after": "90" } },
    });
    const table = await executeSource({ type: "rest", url: "https://api.test/m" }, ORIGIN);

    expect(table.rows).toHaveLength(3);
    expect(table.truncated).toBe(true);
    expect(table.retryAfterSec).toBe(90);
  });

  it("falls back to a reset header when no Retry-After is sent", async () => {
    const resetAt = Math.floor(Date.now() / 1000) + 120;
    stubFetch({ "https://api.test/s": { body: {}, status: 429, headers: { "x-ratelimit-reset": String(resetAt) } } });
    await expect(executeSource({ type: "rest", url: "https://api.test/s" }, ORIGIN)).rejects.toMatchObject({
      retryAfterSec: expect.any(Number),
    });
  });

  it("leaves a healthy response alone even if it carries rate-limit headers", async () => {
    stubFetch({ "https://api.test/ok": { body: rows(1, 2), headers: { "x-ratelimit-remaining": "0", "retry-after": "60" } } });
    const table = await executeSource({ type: "rest", url: "https://api.test/ok" }, ORIGIN);

    expect(table.rows).toHaveLength(2);
    expect(table.retryAfterSec).toBeUndefined();
  });
});

describe("the URL guard on the path that actually fetches", () => {
  it("refuses a source pointed straight at cloud metadata", async () => {
    // The reason this guard exists: the server fetches the URL, so this would put the instance's
    // credentials into a spreadsheet.
    stubFetch({});
    await expect(
      executeSource({ type: "rest", url: "http://169.254.169.254/latest/meta-data/" }, ORIGIN)
    ).rejects.toThrow(/not a public address/);
  });

  it("refuses a source pointed at the server's own loopback", async () => {
    stubFetch({});
    await expect(executeSource({ type: "rest", url: "http://127.0.0.1:9200/_all" }, ORIGIN)).rejects.toThrow(
      /not a public address/
    );
  });

  it("refuses a non-http scheme", async () => {
    stubFetch({});
    await expect(executeSource({ type: "rest", url: "file:///etc/passwd" }, ORIGIN)).rejects.toThrow(/http/);
  });

  it("re-checks after a redirect, which is how a checked URL becomes an unchecked one", async () => {
    // fetch() following redirects by itself would take the request wherever the far end points,
    // past the check that was made on the original URL.
    stubFetch({
      "https://api.test/start": { body: "", status: 302, headers: { location: "http://169.254.169.254/" } },
    });
    await expect(executeSource({ type: "rest", url: "https://api.test/start" }, ORIGIN)).rejects.toThrow(
      /not a public address/
    );
  });

  it("follows an ordinary redirect to a public host", async () => {
    stubFetch({
      "https://api.test/old": { body: "", status: 301, headers: { location: "https://api.test/new" } },
      "https://api.test/new": { body: [{ a: 1 }] },
    });
    const table = await executeSource({ type: "rest", url: "https://api.test/old" }, ORIGIN);
    expect(table.rows).toHaveLength(1);
  });

  it("stops a redirect loop instead of following it forever", async () => {
    stubFetch({
      "https://api.test/a": { body: "", status: 302, headers: { location: "https://api.test/b" } },
      "https://api.test/b": { body: "", status: 302, headers: { location: "https://api.test/a" } },
    });
    await expect(executeSource({ type: "rest", url: "https://api.test/a" }, ORIGIN)).rejects.toThrow(/redirect/i);
  });

  it("lets the app reach its own demo routes, which are relative and not user-controlled", async () => {
    // These resolve to the deployment itself, so a loopback address here is not a warning sign.
    stubFetch({ "https://app.test/api/demo/sales": { body: [{ a: 1 }] } });
    const table = await executeSource({ type: "rest", url: "/api/demo/sales" }, ORIGIN);
    expect(table.rows).toHaveLength(1);
  });

  it("still checks where a relative source is redirected to", async () => {
    stubFetch({
      "https://app.test/api/demo/sales": { body: "", status: 302, headers: { location: "http://10.0.0.5/secrets" } },
    });
    await expect(executeSource({ type: "rest", url: "/api/demo/sales" }, ORIGIN)).rejects.toThrow(
      /not a public address/
    );
  });

  // Regression: a URL that starts with a slash but is not actually relative used to be waved
  // through the guard. `//host` (protocol-relative) and `/\host` both begin with a slash yet
  // `new URL()` resolves them to a foreign origin, so the old `startsWith("/")` fast path fetched
  // the metadata endpoint without ever calling the guard. The fix decides "same origin" by the
  // resolved origin, so these now clear the guard like any other absolute URL and are blocked.
  it("does not treat a protocol-relative URL as same-origin (SSRF bypass)", async () => {
    stubFetch({}); // any fetch at all is a failure — the guard must reject before one is made
    await expect(
      executeSource({ type: "rest", url: "//169.254.169.254/latest/meta-data/" }, ORIGIN)
    ).rejects.toThrow(/not a public address/);
  });

  it("does not treat a backslash-tricked URL as same-origin (SSRF bypass)", async () => {
    stubFetch({});
    await expect(executeSource({ type: "rest", url: "/\\169.254.169.254/" }, ORIGIN)).rejects.toThrow(
      /not a public address/
    );
  });

  it("blocks a userinfo trick that keeps the real host after the @ (SSRF bypass)", async () => {
    stubFetch({});
    await expect(
      executeSource({ type: "rest", url: "//app.test@169.254.169.254/" }, ORIGIN)
    ).rejects.toThrow(/not a public address/);
  });
});

/**
 * A source's credential belongs to the source's own origin — the scheme, host and port of the URL
 * it was set up with. Redirects are followed by hand (so every hop is checked), which also means
 * fetch's own habit of dropping `Authorization` on a cross-origin redirect is this code's job, for
 * whatever header name the source uses.
 */
describe("where a source's credential is sent", () => {
  const AUTH = { name: "X-Api-Key", value: "k-123" };

  /** Like stubFetch, but also records the headers each request carried. */
  function recordFetch(routes: Record<string, Stub>) {
    const sent: Array<{ url: string; key: string | undefined }> = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      sent.push({ url, key: (init.headers as Record<string, string>)[AUTH.name] });
      const stub = routes[url];
      if (!stub) throw new Error(`unexpected fetch: ${url}`);
      const headers = new Headers({ ...(stub.link ? { link: stub.link } : {}), ...(stub.headers ?? {}) });
      return {
        ok: (stub.status ?? 200) < 400,
        status: stub.status ?? 200,
        statusText: "",
        headers,
        text: async () => (typeof stub.body === "string" ? stub.body : JSON.stringify(stub.body)),
      } as unknown as Response;
    });
    return sent;
  }
  const keyAt = (sent: Array<{ url: string; key: string | undefined }>, url: string) => sent.find((s) => s.url === url)?.key;

  it("follows a redirect to another origin, without the credential", async () => {
    const sent = recordFetch({
      "https://api.test/data": { body: "", status: 302, headers: { location: "https://cdn.other.test/data.json" } },
      "https://cdn.other.test/data.json": { body: [{ a: 1 }] },
    });
    const table = await executeSource({ type: "rest", url: "https://api.test/data", authHeader: AUTH }, ORIGIN);
    expect(table.rows).toHaveLength(1);
    expect(keyAt(sent, "https://api.test/data")).toBe("k-123");
    expect(keyAt(sent, "https://cdn.other.test/data.json")).toBeUndefined();
  });

  it("keeps the credential on a redirect within the same origin", async () => {
    const sent = recordFetch({
      "https://api.test/v1/data": { body: "", status: 301, headers: { location: "/v2/data" } },
      "https://api.test/v2/data": { body: [{ a: 1 }] },
    });
    await executeSource({ type: "rest", url: "https://api.test/v1/data", authHeader: AUTH }, ORIGIN);
    expect(keyAt(sent, "https://api.test/v2/data")).toBe("k-123");
  });

  it("treats https → http on the same host as another origin", async () => {
    const sent = recordFetch({
      "https://api.test/data": { body: "", status: 302, headers: { location: "http://api.test/data" } },
      "http://api.test/data": { body: [{ a: 1 }] },
    });
    await executeSource({ type: "rest", url: "https://api.test/data", authHeader: AUTH }, ORIGIN);
    expect(keyAt(sent, "http://api.test/data")).toBeUndefined();
  });

  it("does not put the credential back when a later hop returns to the source's origin", async () => {
    const sent = recordFetch({
      "https://api.test/a": { body: "", status: 302, headers: { location: "https://hop.other.test/b" } },
      "https://hop.other.test/b": { body: "", status: 302, headers: { location: "https://api.test/c" } },
      "https://api.test/c": { body: [{ a: 1 }] },
    });
    await executeSource({ type: "rest", url: "https://api.test/a", authHeader: AUTH }, ORIGIN);
    expect(sent.map((s) => s.key)).toEqual(["k-123", undefined, undefined]);
  });

  it("stops paging at a next link on another origin, keeps the rows, and says the table is partial", async () => {
    const sent = recordFetch({
      "https://api.test/orders": { body: { items: rows(1, 3), next: "https://api.test/orders?page=2" } },
      "https://api.test/orders?page=2": { body: { items: rows(4, 3), next: "https://elsewhere.test/orders?page=3" } },
    });
    const table = await executeSource({ type: "rest", url: "https://api.test/orders", authHeader: AUTH }, ORIGIN);
    expect(sent.map((s) => s.url)).toEqual(["https://api.test/orders", "https://api.test/orders?page=2"]);
    expect(table.rows).toHaveLength(6);
    expect(table.truncated).toBe(true);
  });

  it("stops the same way when the next page comes from a Link header", async () => {
    const sent = recordFetch({
      "https://api.test/items": { body: rows(1, 2), link: '<https://elsewhere.test/items?page=2>; rel="next"' },
    });
    const table = await executeSource({ type: "rest", url: "https://api.test/items", authHeader: AUTH }, ORIGIN);
    expect(sent).toHaveLength(1);
    expect(table.rows).toHaveLength(2);
    expect(table.truncated).toBe(true);
  });
});
