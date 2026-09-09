import { csvToTable, getByPath, jsonToTable } from "@/lib/dataSources/jsonToTable";
import { DataSourceConfig, TableData } from "@/lib/dataSources/types";

export type SourceInput = Pick<DataSourceConfig, "type" | "url" | "method" | "authHeader" | "jsonPath">;

/** Fetches a source and normalizes whatever it returns into a TableData. Runs on the server so
 *  the auth header never reaches the browser and CORS isn't the user's problem. `origin` lets an
 *  app-relative URL ("/api/demo/sales") resolve against the current deployment. */
export async function executeSource(src: SourceInput, origin: string): Promise<TableData> {
  const url = src.url.startsWith("/") ? new URL(src.url, origin).toString() : src.url;
  const headers: Record<string, string> = { Accept: "application/json, text/csv, text/plain;q=0.9, */*;q=0.8" };
  if (src.authHeader?.name && src.authHeader.value) headers[src.authHeader.name] = src.authHeader.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(url, { method: src.method ?? "GET", headers, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());

  const text = await res.text();
  const fetchedAt = new Date().toISOString();
  if (src.type === "csv") return csvToTable(text, fetchedAt);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // Some "JSON" endpoints are really CSV — be forgiving rather than making the user pick the type.
    if (text.includes(",") && text.includes("\n")) return csvToTable(text, fetchedAt);
    throw new Error("Response is not valid JSON");
  }
  const scoped = getByPath(json, src.jsonPath);
  if (scoped === undefined) throw new Error(`Nothing found at path "${src.jsonPath}"`);
  return jsonToTable(scoped, fetchedAt);
}
