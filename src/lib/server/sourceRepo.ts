import { promises as fs } from "fs";
import path from "path";
import { DataSourceConfig, PublicDataSource } from "@/lib/dataSources/types";
import { decryptSecret, encryptSecret, isEncrypted } from "./secretBox";
import { DEMO_SOURCES } from "./demoSources";
import { parseConnectionString } from "./dbGuard";

// Storage is one JSON file on the server. Credentials never leave it — the API only ever returns
// the masked PublicDataSource shape to the browser — and the credential itself is encrypted at
// rest, so a stray backup or disk image is not an API key.
const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "sources.json");


async function readAll(): Promise<DataSourceConfig[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as DataSourceConfig[];
  } catch {
    // Seeded on first run so a fresh clone has something live in the panel straight away.
    await writeAll(DEMO_SOURCES);
    return DEMO_SOURCES;
  }
}

async function writeAll(sources: DataSourceConfig[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(sources, null, 2), "utf8");
}

/**
 * Decrypts a source's credential for use.
 *
 * Done on the way out rather than on the way in so the ciphertext is what sits in memory for the
 * whole of a source's life, and the plaintext exists only for the moment it is put on a header.
 */
export function withSecret(s: DataSourceConfig): DataSourceConfig {
  const out: DataSourceConfig = { ...s };
  if (s.authHeader?.value) out.authHeader = { name: s.authHeader.name, value: decryptSecret(s.authHeader.value) };
  // A connection string is a credential in the same sense and is treated the same way: ciphertext
  // for the whole of its life, plaintext only for the moment a connection is opened.
  if (s.connection) out.connection = decryptSecret(s.connection);
  return out;
}

/** Encrypts the connection string on the way in, the same way an auth header is handled. */
function sealedConnection(connection: string | undefined): string | undefined {
  if (!connection) return undefined;
  return isEncrypted(connection) ? connection : encryptSecret(connection);
}

/** Encrypts a credential on the way in, refusing rather than storing one in the clear. */
function sealed(header: DataSourceConfig["authHeader"]): DataSourceConfig["authHeader"] {
  if (!header?.name || !header.value) return undefined;
  if (isEncrypted(header.value)) return header;
  return { name: header.name, value: encryptSecret(header.value) };
}

export function toPublic(s: DataSourceConfig): PublicDataSource {
  const { authHeader, connection, ...rest } = s;
  const out: PublicDataSource = authHeader
    ? { ...rest, authHeader: { name: authHeader.name, value: MASK, masked: true } }
    : rest;
  if (connection) out.connection = describeConnection(connection);
  return out;
}

export const MASK = "••••••••";

/**
 * What the browser is told about a database connection: the kind, the host and the database name.
 *
 * Not the user, and never the password. The panel has to show *which* database a source points at
 * — otherwise three sources called "sales" are indistinguishable — and it has no business knowing
 * how to reach it. If the stored string cannot be read for any reason, the answer is the mask
 * rather than a best guess: leaking half a credential to say something reassuring is the wrong
 * trade in exactly this place.
 */
export function describeConnection(stored: string): string {
  let raw: string;
  try {
    raw = decryptSecret(stored);
  } catch {
    return MASK;
  }
  const parsed = parseConnectionString(raw);
  if ("error" in parsed) return MASK;
  const port = parsed.port === (parsed.kind === "postgres" ? 5432 : 3306) ? "" : `:${parsed.port}`;
  return `${parsed.kind}://${MASK}@${parsed.host}${port}/${parsed.database}`;
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
    authHeader: sealed(input.authHeader),
    connection: sealedConnection(input.connection),
    id: `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  if (!source.authHeader) delete source.authHeader;
  if (!source.connection) delete source.connection;
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
  // A masked value means "keep what is stored", and what is stored is already encrypted — so it is
  // carried across untouched rather than round-tripped through the cipher for no reason.
  const authHeader =
    patch.authHeader && patch.authHeader.value === "••••••••"
      ? existing.authHeader && { name: patch.authHeader.name, value: existing.authHeader.value }
      : sealed(patch.authHeader);
  // The same "leave it alone" contract as the auth header: the browser was shown a description
  // rather than the string, so anything that is not a new string means keep the stored one.
  const connection =
    patch.connection && !patch.connection.includes(MASK) ? sealedConnection(patch.connection) : existing.connection;
  const next: DataSourceConfig = { ...existing, ...patch, authHeader, connection, id, createdAt: existing.createdAt };
  if (!next.authHeader?.name) delete next.authHeader;
  if (!next.connection) delete next.connection;
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
