// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { DataSourceConfig, DataSourceType, isDbType } from "@/lib/dataSources/types";
import { sqlProblem } from "@/lib/dataSources/sqlGuard";
import { parseConnectionString } from "@/lib/server/dbGuard";

type SourceBody = Omit<DataSourceConfig, "id" | "createdAt">;

/** Validates a source config coming from the setup form. Kept deliberately simple — this is the
 *  one place tech-side input enters the system, so it gets a real shape check, but no schema library. */
export async function parseSourceBody(request: Request): Promise<{ value: SourceBody } | { error: string }> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return { error: "invalid_json" };
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const url = typeof body.url === "string" ? body.url.trim().slice(0, 2000) : "";
  const TYPES: DataSourceType[] = ["rest", "csv", "postgres", "mysql"];
  const type = TYPES.find((t) => t === body.type) ?? null;
  if (!name) return { error: "missing_name" };
  if (!type) return { error: "invalid_type" };

  const refreshRaw = Number(body.refreshSec);
  const refreshSec = Number.isFinite(refreshRaw) ? Math.min(Math.max(Math.round(refreshRaw), 2), 3600) : 30;
  // 0 means "first response only" for a REST source and "the default cap" for a database one. The
  // upper bound is a guard on us as much as on the source: every extra row is more work the server
  // does on the user's behalf.
  const maxRowsRaw = Number(body.maxRows);
  const maxRows = Number.isFinite(maxRowsRaw) ? Math.min(Math.max(Math.round(maxRowsRaw), 0), 50_000) : undefined;

  // A database source names no URL at all: what it has is a connection string and one saved
  // statement. Checked here rather than at connect time so the operator filling in the form is
  // told which half is wrong while they are still looking at it.
  if (isDbType(type)) {
    const connection = typeof body.connection === "string" ? body.connection.trim().slice(0, 2000) : "";
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 8000) : "";
    // A masked string is the form saying "keep the stored one"; the repo resolves it, and the
    // shape check is skipped rather than run against a row of dots.
    if (!connection.includes("\u2022")) {
      const parsed = parseConnectionString(connection);
      if ("error" in parsed) return { error: parsed.error };
      if (parsed.kind !== (type === "postgres" ? "postgres" : "mysql")) return { error: "scheme_type_mismatch" };
    }
    const bad = sqlProblem(query);
    if (bad) return { error: `query_${bad}` };
    return {
      value: { name, type, url: "", connection, query, refreshSec, maxRows },
    };
  }
  // A relative path is a single leading slash followed by neither slash nor backslash. Excluding
  // that second character is what keeps `//host` (protocol-relative) and `/\host` out of the
  // "same origin" fast path in executeSource — both start with a slash but point at a foreign host.
  const isRelativePath = /^\/(?![/\\])/.test(url);
  if (!url || !(isRelativePath || /^https?:\/\//i.test(url))) return { error: "invalid_url" };

  const method = body.method === "POST" ? "POST" : "GET";
  const jsonPath = typeof body.jsonPath === "string" && body.jsonPath.trim() ? body.jsonPath.trim().slice(0, 200) : undefined;

  let authHeader: SourceBody["authHeader"];
  const ah = body.authHeader as { name?: unknown; value?: unknown } | undefined;
  if (ah && typeof ah.name === "string" && ah.name.trim() && typeof ah.value === "string") {
    authHeader = { name: ah.name.trim().slice(0, 100), value: ah.value.slice(0, 2000) };
  }

  return { value: { name, type, url, method, refreshSec, jsonPath, maxRows, authHeader } };
}
