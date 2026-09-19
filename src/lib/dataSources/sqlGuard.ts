/**
 * What a saved database query is allowed to be.
 *
 * The premise of a database source is that **one technical person writes the query once and the
 * people using the spreadsheet never see SQL**. That makes the query trusted input in the ordinary
 * sense — nobody types it into a cell — and it is still checked, for two reasons that have nothing
 * to do with malice:
 *
 *  1. The operator token is the only thing between a browser and this form. If it leaks, "write a
 *     query" becomes "run anything on the database", and a leaked token should not be a dropped
 *     table.
 *  2. A saved query is run again on every refresh, forever, by a scheduler nobody is watching. A
 *     statement that was meant to run once is the wrong thing to leave on that loop.
 *
 * **This is the second line of defence, not the first.** The first is the connection: every query
 * runs inside a read-only transaction, so a write is refused by the database itself whatever this
 * function thinks. A keyword list can always be walked around; a read-only transaction cannot.
 * They are both here because the first one produces a clear error at save time and the second one
 * produces a correct outcome at run time, and the two are not the same job.
 */

export type SqlProblem =
  | "empty"
  | "notASelect"
  | "multipleStatements"
  | "unterminatedComment"
  | "unterminatedString"
  | "writeKeyword"
  | "tooLong";

/** Longer than any query a form should be carrying, and short enough to bound the scan. */
const MAX_QUERY_LENGTH = 8000;

/**
 * Statements that change something, read the server's disk, or hold a connection open.
 *
 * Matched as whole words on the *stripped* text, so a column called `update_at` or a string
 * containing the word "delete" does not trip it. `INTO` covers both `SELECT … INTO new_table`
 * (Postgres) and `SELECT … INTO OUTFILE` (MySQL), which are the two ways a SELECT writes.
 */
const FORBIDDEN = [
  "insert", "update", "delete", "merge", "upsert", "replace",
  "drop", "alter", "create", "truncate", "rename", "comment",
  "grant", "revoke", "set", "reset", "copy", "load", "lock", "unlock",
  "call", "do", "execute", "prepare", "deallocate", "discard", "listen", "notify",
  "vacuum", "analyze", "reindex", "cluster", "checkpoint", "refresh",
  "begin", "commit", "rollback", "savepoint", "start",
  "into", "outfile", "dumpfile", "handler", "flush", "shutdown", "kill",
  "pg_sleep", "pg_read_file", "pg_read_binary_file", "pg_ls_dir", "lo_import", "lo_export",
  "dblink", "load_file", "benchmark", "sleep", "sys_exec", "sys_eval",
];

/**
 * The statement with comments and string/identifier literals blanked out.
 *
 * Blanked rather than removed so offsets stay put and a quoted `'; drop table x; --'` cannot make
 * two statements out of one. Returns a problem instead when a comment or a literal never closes —
 * an unterminated quote is how "the rest of my statement is a string" becomes "the rest of your
 * statement is mine", and guessing where it ends is exactly the guess to refuse.
 */
export function stripSqlLiterals(sql: string): { stripped: string } | { problem: SqlProblem } {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      if (end === -1) return { problem: "unterminatedComment" };
      out += " ".repeat(end + 2 - i);
      i = end + 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      let j = i + 1;
      while (j < sql.length) {
        // A doubled quote is one literal quote and the string carries on — in every dialect here.
        if (sql[j] === ch && sql[j + 1] === ch) {
          j += 2;
          continue;
        }
        // MySQL also lets a backslash escape the closing quote; Postgres does not, by default.
        if (sql[j] === "\\" && ch !== '"' && j + 1 < sql.length) {
          j += 2;
          continue;
        }
        if (sql[j] === ch) break;
        j += 1;
      }
      if (j >= sql.length) return { problem: "unterminatedString" };
      out += " ".repeat(j + 1 - i);
      i = j + 1;
      continue;
    }
    // Postgres dollar-quoting: $tag$ … $tag$, which is how a function body hides anything at all.
    const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
    if (dollar) {
      const close = sql.indexOf(dollar[0], i + dollar[0].length);
      if (close === -1) return { problem: "unterminatedString" };
      const stop = close + dollar[0].length;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }

    out += ch;
    i += 1;
  }
  return { stripped: out };
}

/** What is wrong with a saved query, or null when nothing is. */
export function sqlProblem(sql: string): SqlProblem | null {
  const text = sql.trim();
  if (text === "") return "empty";
  if (text.length > MAX_QUERY_LENGTH) return "tooLong";

  const scan = stripSqlLiterals(text);
  if ("problem" in scan) return scan.problem;
  const stripped = scan.stripped;

  // A trailing semicolon is how people write SQL; two statements is a different thing entirely.
  if (stripped.replace(/;\s*$/, "").includes(";")) return "multipleStatements";

  if (!/^\s*(select|with)\b/i.test(stripped)) return "notASelect";

  const words = stripped.toLowerCase().match(/[a-z_][a-z0-9_]*/g) ?? [];
  if (words.some((w) => FORBIDDEN.includes(w))) return "writeKeyword";
  return null;
}

/**
 * The query with a row cap put around it.
 *
 * Wrapped in a derived table rather than appended, because appending `LIMIT n` to a statement that
 * already ends in `LIMIT 5 OFFSET 10` is a syntax error, and to one ending in `FOR UPDATE` it is
 * worse than that. The alias is required by MySQL and harmless in Postgres.
 *
 * This is a second belt on top of the driver's own row cap: the point is for the *database* to stop
 * producing rows, not for the server to receive ten million of them and throw most away.
 */
export function withRowLimit(sql: string, maxRows: number): string {
  const body = sql.trim().replace(/;\s*$/, "");
  return `select * from (${body}) as exceltogo_rows limit ${Math.max(1, Math.floor(maxRows))}`;
}
