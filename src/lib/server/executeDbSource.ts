// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { tableFromDbRows } from "@/lib/dataSources/dbRows";
import { DEFAULT_MAX_ROWS } from "@/lib/dataSources/paginate";
import { sqlProblem, withRowLimit } from "@/lib/dataSources/sqlGuard";
import { DataSourceConfig, TableData } from "@/lib/dataSources/types";
import { assertConnectable, type DbTarget } from "./dbGuard";

export type DbSourceInput = Pick<DataSourceConfig, "type" | "connection" | "query" | "maxRows">;

/** Long enough for a report query on a cold cache, short enough that a refresh cannot hang. */
const STATEMENT_TIMEOUT_MS = 20_000;
/** A database that does not answer the handshake is a firewall, not a slow query. */
const CONNECT_TIMEOUT_MS = 8_000;
/** One more row than asked for, so "there was more" can be told from "that was all of it". */
const PROBE = 1;

/**
 * Runs the operator's saved query and hands back the rows as a table.
 *
 * Three things make this safe to leave on a refresh loop, in the order they matter:
 *
 * 1. **The connection is checked before it is opened** (`assertConnectable`), for the same reason a
 *    URL is: the server makes the connection, so the string is a request-forgery primitive.
 * 2. **Every query runs in a read-only transaction.** That is the guarantee — a write is refused
 *    by the database itself, whatever `sqlProblem` thought of the text. `sqlProblem` is the second
 *    layer, and it exists so the operator finds out at save time rather than at 3am.
 * 3. **The row cap is applied by the database**, not by throwing rows away after receiving them,
 *    and a statement timeout bounds the rest.
 *
 * The drivers are imported dynamically. A deployment with no database source never loads them, and
 * `pg` and `mysql2` are several megabytes of server code each — on a serverless host that is cold
 * start time charged to every request, for a feature most deployments do not use.
 */
export async function executeDbSource(src: DbSourceInput): Promise<TableData> {
  const query = (src.query ?? "").trim();
  const problem = sqlProblem(query);
  if (problem) throw new Error(`query_${problem}`);

  const target = await assertConnectable(src.connection ?? "");
  const maxRows = src.maxRows && src.maxRows > 0 ? src.maxRows : DEFAULT_MAX_ROWS;
  const capped = withRowLimit(query, maxRows + PROBE);

  const result = target.kind === "postgres" ? await runPostgres(target, capped) : await runMysql(target, capped);

  const truncated = result.rows.length > maxRows;
  if (truncated) result.rows.length = maxRows;
  return tableFromDbRows(result.columns, result.rows, new Date().toISOString(), {
    truncated: truncated || undefined,
  });
}

interface RawResult {
  columns: string[];
  rows: unknown[][];
}

async function runPostgres(target: DbTarget, sql: string): Promise<RawResult> {
  const { Client } = await import("pg");
  const client = new Client({
    host: target.host,
    port: target.port,
    database: target.database,
    user: target.user,
    password: target.password,
    // `rejectUnauthorized` is left at the driver's default rather than turned off: a connection
    // that only *looks* encrypted is worse than one that admits it is not, and `sslmode=disable`
    // in the string is how somebody says they know.
    ssl: target.ssl ? {} : false,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    // `rowMode: "array"` keeps two columns of the same name apart, which an object row cannot.
    application_name: "ExcelToGo",
  });

  await client.connect();
  try {
    // The transaction is the real guarantee; the guard on the text is the earlier warning.
    await client.query("begin read only");
    const res = await client.query({ text: sql, rowMode: "array" });
    await client.query("commit");
    const fields = (res.fields ?? []).map((f) => f.name);
    return { columns: fields, rows: res.rows as unknown[][] };
  } finally {
    // `end()` rather than a pool release: one query, one connection, closed whatever happened.
    await client.end().catch(() => {});
  }
}

async function runMysql(target: DbTarget, sql: string): Promise<RawResult> {
  const mysql = await import("mysql2/promise");
  const conn = await mysql.createConnection({
    host: target.host,
    port: target.port,
    database: target.database,
    user: target.user,
    password: target.password,
    ssl: target.ssl ? {} : undefined,
    connectTimeout: CONNECT_TIMEOUT_MS,
    // Off, and load-bearing: with it on, one string from the operator could carry several
    // statements past a guard that only checked the first.
    multipleStatements: false,
    // Keeps big integers and exact decimals as strings rather than rounding them into a double.
    supportBigNumbers: true,
    bigNumberStrings: true,
    decimalNumbers: false,
    dateStrings: false,
    rowsAsArray: true,
  });

  try {
    await conn.query("set session transaction read only");
    await conn.query(`set session max_execution_time = ${STATEMENT_TIMEOUT_MS}`);
    const [rows, fields] = await conn.query(sql);
    const columns = (fields ?? []).map((f) => f.name);
    return { columns, rows: (Array.isArray(rows) ? rows : []) as unknown[][] };
  } finally {
    await conn.end().catch(() => {});
  }
}
