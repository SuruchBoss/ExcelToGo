import { describe, expect, it } from "vitest";
import { nextPageUrl, parseLinkHeader } from "./paginate";

const BASE = "https://api.example.com/orders?page=1";

function next(body: unknown, opts: Partial<Parameters<typeof nextPageUrl>[0]> = {}) {
  return nextPageUrl({ currentUrl: BASE, body, pageRecords: 25, firstPageRecords: 25, ...opts });
}

describe("parseLinkHeader", () => {
  it("pulls each rel out of a multi-link header", () => {
    const h = '<https://a/x?page=2>; rel="next", <https://a/x?page=9>; rel="last"';
    expect(parseLinkHeader(h)).toEqual({ next: "https://a/x?page=2", last: "https://a/x?page=9" });
  });

  it("tolerates unquoted rels and extra params", () => {
    expect(parseLinkHeader('<https://a/x>; type=json; rel=next')).toEqual({ next: "https://a/x" });
  });

  it("returns nothing for a missing or unparseable header", () => {
    expect(parseLinkHeader(null)).toEqual({});
    expect(parseLinkHeader("garbage")).toEqual({});
  });
});

describe("nextPageUrl", () => {
  it("prefers the Link header over anything in the body", () => {
    const r = next({ next: "https://api.example.com/orders?page=99" }, { linkHeader: '<https://api.example.com/orders?page=2>; rel="next"' });
    expect(r).toEqual({ url: "https://api.example.com/orders?page=2", via: "link-header" });
  });

  it("follows a next-url field in the body", () => {
    expect(next({ items: [], next: "https://api.example.com/orders?page=2" })).toEqual({
      url: "https://api.example.com/orders?page=2",
      via: "next-url",
    });
  });

  it("resolves a relative next link against the current URL", () => {
    expect(next({ next: "/orders?page=3" })?.url).toBe("https://api.example.com/orders?page=3");
  });

  it("reads a nested next link, including HAL-style { href }", () => {
    expect(next({ _links: { next: { href: "/orders?page=4" } } })).toEqual({
      url: "https://api.example.com/orders?page=4",
      via: "next-url",
    });
  });

  it("stops when a next field is present but null — that's the API saying 'last page'", () => {
    expect(next({ items: [1], next: null })).toBeNull();
    expect(next({ paging: { next: null } })).toBeNull();
  });

  it("sends a cursor back as a query param", () => {
    const r = nextPageUrl({ currentUrl: "https://api.example.com/events", body: { next_cursor: "abc123" }, pageRecords: 25, firstPageRecords: 25 });
    expect(r).toEqual({ url: "https://api.example.com/events?cursor=abc123", via: "cursor" });
  });

  it("reuses the cursor param name the URL already used", () => {
    const r = nextPageUrl({
      currentUrl: "https://api.example.com/events?page_token=one",
      body: { nextPageToken: "two" },
      pageRecords: 25,
      firstPageRecords: 25,
    });
    expect(r?.url).toBe("https://api.example.com/events?page_token=two");
  });

  it("stops on an empty cursor rather than guessing further", () => {
    expect(next({ next_cursor: "" })).toBeNull();
  });

  it("bumps a page param the URL already carries when the body says nothing", () => {
    expect(next({ items: [1, 2] })).toEqual({ url: "https://api.example.com/orders?page=2", via: "page-param" });
  });

  it("advances an offset param by the number of rows just received", () => {
    const r = nextPageUrl({
      currentUrl: "https://api.example.com/rows?offset=50&limit=25",
      body: { items: [] },
      pageRecords: 25,
      firstPageRecords: 25,
    });
    expect(r).toEqual({ url: "https://api.example.com/rows?offset=75&limit=25", via: "offset-param" });
  });

  it("never invents a page param for a URL that has none", () => {
    expect(nextPageUrl({ currentUrl: "https://api.example.com/all", body: { items: [1] }, pageRecords: 3, firstPageRecords: 3 })).toBeNull();
  });

  it("treats a short page as the last one when only guessing from params", () => {
    expect(next({ items: [1] }, { pageRecords: 7, firstPageRecords: 25 })).toBeNull();
  });

  it("keeps following an explicit next link even on a short page", () => {
    expect(next({ next: "/orders?page=2" }, { pageRecords: 7, firstPageRecords: 25 })?.via).toBe("next-url");
  });

  it("stops on an empty page however the next page was signalled", () => {
    expect(next({ next: "/orders?page=2" }, { pageRecords: 0 })).toBeNull();
    expect(next({ items: [] }, { pageRecords: 0 })).toBeNull();
  });

  it("stops when the next link points back at the page just fetched", () => {
    expect(next({ next: BASE })).toBeNull();
  });

  it("refuses a next value that isn't a link, rather than fetching it as a relative path", () => {
    expect(next({ next: "no more pages" })).toBeNull();
    expect(next({ next: "ht!tp://%%%" })).toBeNull();
    expect(next({ next: "?page=2" })?.url).toBe("https://api.example.com/orders?page=2");
  });
});
