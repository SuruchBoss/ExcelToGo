// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { promises as dns } from "dns";
import net from "net";
import { BlockedUrlError, isBlockedAddress } from "./urlGuard";

/**
 * Decides whether the server is allowed to open a database connection somebody typed in.
 *
 * Same shape of problem as `urlGuard`, and the same consequence: the *server* makes the
 * connection, so a connection string is a request-forgery primitive with a different protocol on
 * the front. `postgres://169.254.169.254:80/x` is a port scan with a friendly error message.
 *
 * One thing is genuinely different, and it is the reason this is not just a call into
 * `assertFetchable`. **A database on a private address is the normal case.** An RDS instance in a
 * VPC, a Postgres container next to the app — those are private by design, and the REST rule
 * ("public addresses only") would make the whole feature useless in exactly the deployments it is
 * for. So the private-address rule stands by default and `SOURCES_ALLOWED_DB_HOSTS` is the way
 * out: an operator who names a host there has said, in a file only they can write, that the server
 * may reach it. Nothing a browser sends can add to that list, which is the property that matters.
 */

const POSTGRES_PROTOCOLS = ["postgres:", "postgresql:"];
const MYSQL_PROTOCOLS = ["mysql:", "mariadb:"];

export type DbKind = "postgres" | "mysql";

export interface DbTarget {
  kind: DbKind;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  /** True when the operator allow-listed this host, which is also the only way a private one gets through. */
  allowListed: boolean;
  /** Whether TLS was asked for in the string (`sslmode=require`, `?ssl=true`). */
  ssl: boolean;
}

const DEFAULT_PORT: Record<DbKind, number> = { postgres: 5432, mysql: 3306 };

function allowedDbHosts(): string[] {
  return (process.env.SOURCES_ALLOWED_DB_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Reads a connection string without connecting to anything.
 *
 * Split out from the check so it can be tested on its own, and so the error for "that is not a
 * connection string" is distinguishable from "that host is not allowed" — the operator filling in
 * the form needs to be told which of the two happened.
 */
export function parseConnectionString(raw: string): DbTarget | { error: string } {
  const text = raw.trim();
  if (text === "") return { error: "missing_connection" };

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { error: "invalid_connection" };
  }

  const protocol = url.protocol.toLowerCase();
  const kind: DbKind | null = POSTGRES_PROTOCOLS.includes(protocol)
    ? "postgres"
    : MYSQL_PROTOCOLS.includes(protocol)
      ? "mysql"
      : null;
  if (!kind) return { error: "invalid_scheme" };

  // A Postgres string may name a unix socket directory instead of a host, which would step around
  // every address check there is by not using an address. There is no case for it here: the
  // database this app talks to is somewhere else by definition.
  const hostRaw = decodeURIComponent(url.hostname).replace(/^\[|\]$/g, "");
  if (hostRaw === "" || hostRaw.startsWith("/") || url.searchParams.has("host")) {
    return { error: "invalid_host" };
  }

  const port = url.port ? Number(url.port) : DEFAULT_PORT[kind];
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { error: "invalid_port" };

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) return { error: "missing_database" };

  const sslParam = (url.searchParams.get("sslmode") ?? url.searchParams.get("ssl") ?? "").toLowerCase();
  const ssl = sslParam !== "" && sslParam !== "disable" && sslParam !== "false" && sslParam !== "0";

  return {
    kind,
    host: hostRaw,
    port,
    database,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    allowListed: allowedDbHosts().includes(hostRaw.toLowerCase()),
    ssl,
  };
}

/**
 * Throws unless the server may connect to this string.
 *
 * Resolves the name and judges every address it gets back, for the same reason the URL guard does:
 * `db.evil.test` resolving to 127.0.0.1 is the whole attack, and a name that resolves to one
 * public and one private address would otherwise be decided by whichever the driver happens to
 * pick.
 */
export async function assertConnectable(raw: string): Promise<DbTarget> {
  const parsed = parseConnectionString(raw);
  if ("error" in parsed) throw new BlockedUrlError(parsed.error);
  if (parsed.allowListed) return parsed;

  let addresses: string[];
  if (net.isIP(parsed.host)) {
    addresses = [parsed.host];
  } else {
    try {
      addresses = (await dns.lookup(parsed.host, { all: true })).map((a) => a.address);
    } catch {
      throw new BlockedUrlError(`Could not resolve ${parsed.host}.`);
    }
  }
  if (addresses.length === 0) throw new BlockedUrlError(`Could not resolve ${parsed.host}.`);

  const blocked = addresses.find(isBlockedAddress);
  if (blocked) {
    throw new BlockedUrlError(
      `${parsed.host} resolves to ${blocked}, which is not a public address. Add it to SOURCES_ALLOWED_DB_HOSTS to allow it deliberately.`
    );
  }
  return parsed;
}
