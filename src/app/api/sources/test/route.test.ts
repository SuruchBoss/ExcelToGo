// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The URL guard resolves hostnames for real, and api.test does not exist; a public address keeps it on.
vi.mock("dns", () => ({ promises: { lookup: async () => [{ address: "93.184.216.34", family: 4 }] } }));

import { MAX_DELIVERED_BYTES, MAX_ROWS_CEILING } from "@/lib/dataSources/fetchLimits";
import { POST } from "./route";

/**
 * What a refresh sends to the browser, measured on the route's own response (#80).
 *
 * The routes answered with the whole table in one `Response.json`. Vercel refuses a function
 * response over 4.5 MB, so a source the server had fetched without trouble reached the browser as a
 * bare 413 — at a row count the form offers. These run the real route over the two shapes measured
 * for #18/#19, at the form's own ceiling of 50,000 rows.
 */
const TOKEN = "t".repeat(32);
beforeEach(() => vi.stubEnv("SOURCES_ADMIN_TOKEN", TOKEN));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const CHANNELS = ["หน้าร้าน", "เดลิเวอรี่", "ออนไลน์"];
const STATUSES = ["ชำระแล้ว", "รอชำระ", "ยกเลิก"];
/** The demo's orders: seven fields, a little Thai. ~170 bytes a row upstream. */
const orders = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    order_id: `SO-${1000 + i}`,
    channel: CHANNELS[i % 3],
    status: STATUSES[i % 3],
    qty: 1 + (i % 9),
    unit_price: 45 + ((i * 17) % 120),
    total: 999,
    ordered_at: new Date(1.79e12 - i * 3.6e6).toISOString(),
  }));
/** Twenty fields, mostly Thai text. ~770 bytes a row upstream, a little heavier than #18's 698. */
const wide = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const r: Record<string, string | number> = {};
    for (let f = 0; f < 20; f++) r[`field_${f}`] = f % 4 === 3 ? i * f : `ข้อมูลไทย${i}`;
    return r;
  });

function serve(items: unknown[]) {
  const body = JSON.stringify({ items });
  vi.stubGlobal("fetch", async () => new Response(body, { headers: { "content-type": "application/json" } }));
}

async function refresh() {
  const res = await POST(
    new Request("https://app.test/api/sources/test", {
      method: "POST",
      headers: { "content-type": "application/json", "x-sources-token": TOKEN },
      body: JSON.stringify({ name: "s", type: "rest", url: "https://api.test/rows", maxRows: MAX_ROWS_CEILING }),
    })
  );
  const text = await res.text();
  return { status: res.status, bytes: Buffer.byteLength(text), table: JSON.parse(text) };
}

describe("a refresh never sends the browser more than the delivery ceiling (#80)", () => {
  it("fits under Vercel's 4.5 MB response limit, with room for headers", () => {
    expect(MAX_DELIVERED_BYTES).toBeLessThan(4.5 * 1000 * 1000 * 0.95);
  });

  it("twenty fields of Thai text at 50,000 rows: cut to fit, and marked as a size cut", async () => {
    serve(wide(MAX_ROWS_CEILING));
    const { status, bytes, table } = await refresh();
    expect(status).toBe(200);
    expect(bytes).toBeLessThanOrEqual(MAX_DELIVERED_BYTES);
    expect(table.truncated).toBe(true);
    expect(table.sizeLimited).toBe(true);
    // As many rows as fit, not a token handful: at ~560 bytes a row, over 7,000.
    expect(table.rows.length).toBeGreaterThan(7_000);
    expect(table.rows.at(-1)[0]).toBe(`ข้อมูลไทย${table.rows.length - 1}`);
  }, 30_000);

  it("the demo's shape at 30,000 rows arrives whole, and says nothing about size", async () => {
    serve(orders(30_000));
    const { bytes, table } = await refresh();
    expect(bytes).toBeLessThanOrEqual(MAX_DELIVERED_BYTES);
    expect(table.rows).toHaveLength(30_000);
    expect(table.truncated).toBeUndefined();
    expect(table.sizeLimited).toBeUndefined();
  }, 30_000);

  it("the demo's shape at the full 50,000 rows is cut to fit too", async () => {
    serve(orders(MAX_ROWS_CEILING));
    const { bytes, table } = await refresh();
    expect(bytes).toBeLessThanOrEqual(MAX_DELIVERED_BYTES);
    expect(table.sizeLimited).toBe(true);
    expect(table.rows.length).toBeGreaterThan(40_000);
  }, 30_000);
});
