import { promises as fs } from "fs";
import path from "path";
import { DataSourceConfig, PublicDataSource } from "@/lib/dataSources/types";

// Dev-stage storage: one JSON file on the server. Credentials never leave this file — the API
// only ever returns the masked PublicDataSource shape to the browser.
const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "sources.json");

/** Seeded on first run so the panel has something live to show immediately. Both point at the
 *  app's own demo endpoints, which return fresh, drifting numbers on every call. */
const DEFAULT_SOURCES: DataSourceConfig[] = [
  {
    id: "demo-sales",
    name: "ยอดขายสด (ตัวอย่าง)",
    type: "rest",
    url: "/api/demo/sales",
    method: "GET",
    refreshSec: 5,
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "demo-summary",
    name: "สรุปวันนี้ (ตัวอย่าง)",
    type: "rest",
    url: "/api/demo/summary",
    method: "GET",
    refreshSec: 5,
    createdAt: new Date(0).toISOString(),
  },
];

async function readAll(): Promise<DataSourceConfig[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as DataSourceConfig[];
  } catch {
    await writeAll(DEFAULT_SOURCES);
    return DEFAULT_SOURCES;
  }
}

async function writeAll(sources: DataSourceConfig[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(sources, null, 2), "utf8");
}

export function toPublic(s: DataSourceConfig): PublicDataSource {
  const { authHeader, ...rest } = s;
  return authHeader ? { ...rest, authHeader: { name: authHeader.name, value: "••••••••", masked: true } } : rest;
}

export async function listSources(): Promise<DataSourceConfig[]> {
  return readAll();
}

export async function getSource(id: string): Promise<DataSourceConfig | undefined> {
  return (await readAll()).find((s) => s.id === id);
}

export async function createSource(input: Omit<DataSourceConfig, "id" | "createdAt">): Promise<DataSourceConfig> {
  const all = await readAll();
  const source: DataSourceConfig = {
    ...input,
    id: `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  await writeAll([...all, source]);
  return source;
}

/** A masked auth value coming back from the browser means "keep the existing secret". */
export async function updateSource(
  id: string,
  patch: Partial<Omit<DataSourceConfig, "id" | "createdAt">>
): Promise<DataSourceConfig | undefined> {
  const all = await readAll();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return undefined;
  const existing = all[idx];
  const authHeader =
    patch.authHeader && patch.authHeader.value === "••••••••"
      ? { name: patch.authHeader.name, value: existing.authHeader?.value ?? "" }
      : patch.authHeader;
  const next: DataSourceConfig = { ...existing, ...patch, authHeader, id, createdAt: existing.createdAt };
  if (!next.authHeader?.name) delete next.authHeader;
  all[idx] = next;
  await writeAll(all);
  return next;
}

export async function deleteSource(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((s) => s.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
