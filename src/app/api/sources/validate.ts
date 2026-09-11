import { DataSourceConfig } from "@/lib/dataSources/types";

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
  const type = body.type === "csv" ? "csv" : body.type === "rest" ? "rest" : null;
  if (!name) return { error: "missing_name" };
  if (!type) return { error: "invalid_type" };
  if (!url || !(url.startsWith("/") || /^https?:\/\//i.test(url))) return { error: "invalid_url" };

  const refreshRaw = Number(body.refreshSec);
  const refreshSec = Number.isFinite(refreshRaw) ? Math.min(Math.max(Math.round(refreshRaw), 2), 3600) : 30;
  const method = body.method === "POST" ? "POST" : "GET";
  const jsonPath = typeof body.jsonPath === "string" && body.jsonPath.trim() ? body.jsonPath.trim().slice(0, 200) : undefined;

  // 0 means "first response only". The upper bound is a guard on us as much as on the API: every
  // extra row is another request the server makes on the user's behalf.
  const maxRowsRaw = Number(body.maxRows);
  const maxRows = Number.isFinite(maxRowsRaw) ? Math.min(Math.max(Math.round(maxRowsRaw), 0), 50_000) : undefined;

  let authHeader: SourceBody["authHeader"];
  const ah = body.authHeader as { name?: unknown; value?: unknown } | undefined;
  if (ah && typeof ah.name === "string" && ah.name.trim() && typeof ah.value === "string") {
    authHeader = { name: ah.name.trim().slice(0, 100), value: ah.value.slice(0, 2000) };
  }

  return { value: { name, type, url, method, refreshSec, jsonPath, maxRows, authHeader } };
}
