// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from "vitest";
import { executeDbSource } from "./executeDbSource";
import { BlockedUrlError } from "./urlGuard";

/**
 * Everything that happens *before* a connection is opened.
 *
 * There is no database in CI, and standing one up to test this would test the driver rather than
 * this file. What is worth pinning without one is the order: a query that should never run must be
 * refused before anything is resolved or dialled, because "we connected, then decided not to" is
 * still a connection somebody's firewall logged. The rows-to-table half is covered by
 * `dbRows.test.ts`, and the query and connection rules by `sqlGuard` and `dbGuard`.
 */
const source = (over: Partial<Parameters<typeof executeDbSource>[0]> = {}) => ({
  type: "postgres" as const,
  connection: "postgres://u:p@db.example.com:5432/shop",
  query: "select 1",
  ...over,
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SOURCES_ALLOWED_DB_HOSTS;
});

describe("what is refused before anything is dialled", () => {
  it("refuses a query that writes, and names which rule said no", async () => {
    await expect(executeDbSource(source({ query: "delete from orders" }))).rejects.toThrow("query_notASelect");
    await expect(executeDbSource(source({ query: "select 1; drop table t" }))).rejects.toThrow(
      "query_multipleStatements"
    );
    await expect(executeDbSource(source({ query: "  " }))).rejects.toThrow("query_empty");
  });

  it("checks the query before it resolves the host", async () => {
    // Order matters: a lookup for a host we were never going to use is still a lookup, and on a
    // private network it is still a probe.
    const dns = await import("dns");
    const lookup = vi.spyOn(dns.promises, "lookup");
    await expect(executeDbSource(source({ query: "drop table orders" }))).rejects.toThrow("query_notASelect");
    expect(lookup).not.toHaveBeenCalled();
  });

  it("refuses a private address before the driver is even loaded", async () => {
    await expect(executeDbSource(source({ connection: "postgres://u:p@169.254.169.254:5432/x" }))).rejects.toBeInstanceOf(
      BlockedUrlError
    );
  });

  it("refuses a source with no connection string at all", async () => {
    await expect(executeDbSource(source({ connection: undefined }))).rejects.toThrow("missing_connection");
  });
});
