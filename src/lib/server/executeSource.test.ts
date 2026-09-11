import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_PAGES } from "@/lib/dataSources/paginate";
import { executeSource } from "./executeSource";

const ORIGIN = "https://app.test";

interface Stub {
  body: unknown | string;
  link?: string;
  status?: number;
}

/** Serves canned responses by URL and records the order they were asked for. */
function stubFetch(routes: Record<string, Stub>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url);
    const stub = routes[url];
    if (!stub) throw new Error(`unexpected fetch: ${url}`);
    const headers = new Headers(stub.link ? { link: stub.link } : {});
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
