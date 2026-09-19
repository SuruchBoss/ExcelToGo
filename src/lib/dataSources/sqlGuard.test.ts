import { describe, expect, it } from "vitest";
import { sqlProblem, stripSqlLiterals, withRowLimit } from "./sqlGuard";

const stripped = (sql: string) => {
  const r = stripSqlLiterals(sql);
  return "stripped" in r ? r.stripped : r.problem;
};

describe("what a saved query may be", () => {
  it("takes an ordinary SELECT, and a CTE", () => {
    expect(sqlProblem("select id, name from customers where region = 'เหนือ'")).toBeNull();
    expect(sqlProblem("with recent as (select * from orders) select * from recent")).toBeNull();
    expect(sqlProblem("  SELECT 1  ")).toBeNull();
  });

  it("takes a trailing semicolon, because that is how people write SQL", () => {
    expect(sqlProblem("select 1;")).toBeNull();
    expect(sqlProblem("select 1;  \n ")).toBeNull();
  });

  it("refuses a second statement", () => {
    expect(sqlProblem("select 1; drop table customers")).toBe("multipleStatements");
  });

  it("refuses anything that is not a read", () => {
    expect(sqlProblem("delete from customers")).toBe("notASelect");
    expect(sqlProblem("update customers set name = 'x'")).toBe("notASelect");
    expect(sqlProblem("")).toBe("empty");
  });

  it("refuses a write hidden inside a SELECT", () => {
    // `SELECT … INTO` writes a table in Postgres and a file in MySQL, and neither announces itself
    // as anything but a select.
    expect(sqlProblem("select * into copy_of_customers from customers")).toBe("writeKeyword");
    expect(sqlProblem("select * from customers into outfile '/tmp/x'")).toBe("writeKeyword");
    expect(sqlProblem("with x as (delete from t returning *) select * from x")).toBe("writeKeyword");
  });

  it("refuses the functions that read the server's disk or hold the connection open", () => {
    expect(sqlProblem("select pg_read_file('/etc/passwd')")).toBe("writeKeyword");
    expect(sqlProblem("select load_file('/etc/passwd')")).toBe("writeKeyword");
    expect(sqlProblem("select pg_sleep(600)")).toBe("writeKeyword");
  });

  it("does not trip over a column whose name merely contains a keyword", () => {
    // The check is on whole words, so this is a normal query and has to stay one.
    expect(sqlProblem("select updated_at, created_by, set_name from t")).toBeNull();
  });

  it("does not trip over a keyword inside a string or a quoted identifier", () => {
    expect(sqlProblem("select 'please delete this row' as note from t")).toBeNull();
    expect(sqlProblem('select "drop" from t')).toBeNull();
  });

  it("refuses a semicolon smuggled past the scanner in a comment or a string", () => {
    expect(sqlProblem("select 1 -- ; drop table t")).toBeNull();
    expect(sqlProblem("select 1 /* ; drop table t */")).toBeNull();
    expect(sqlProblem("select '; drop table t' as s")).toBeNull();
    expect(sqlProblem("select 1 /* unterminated")).toBe("unterminatedComment");
    expect(sqlProblem("select 'unterminated")).toBe("unterminatedString");
  });

  it("sees through Postgres dollar-quoting, which is where anything at all can hide", () => {
    expect(sqlProblem("select $$; drop table t$$ as s")).toBeNull();
    expect(sqlProblem("select $tag$ delete from t $tag$ as s")).toBeNull();
    expect(sqlProblem("select $tag$ never closed")).toBe("unterminatedString");
  });

  it("refuses a query longer than any form should be carrying", () => {
    expect(sqlProblem(`select ${"a".repeat(9000)} from t`)).toBe("tooLong");
  });
});

describe("blanking literals rather than deleting them", () => {
  it("keeps the text the same length, so nothing can be spliced together", () => {
    const sql = "select 'abc', 1 from t";
    expect(stripped(sql)).toHaveLength(sql.length);
  });

  it("understands a doubled quote as one character inside the string", () => {
    expect(sqlProblem("select 'it''s fine' from t")).toBeNull();
  });

  it("understands MySQL's backslash escape, but not in a quoted identifier", () => {
    expect(sqlProblem("select 'a\\' b' from t")).toBeNull();
    // Postgres treats "" as the only escape inside a quoted identifier, so a backslash there is
    // an ordinary character and the identifier still ends at the next quote.
    expect(stripped('select "a\\" from t')).toBe("select      from t");
  });
});

describe("the row cap", () => {
  it("wraps rather than appends, so an existing LIMIT is not a syntax error", () => {
    expect(withRowLimit("select * from t limit 5 offset 10", 100)).toBe(
      "select * from (select * from t limit 5 offset 10) as exceltogo_rows limit 100"
    );
  });

  it("drops a trailing semicolon, which would close the statement mid-wrap", () => {
    expect(withRowLimit("select 1;", 10)).toBe("select * from (select 1) as exceltogo_rows limit 10");
  });

  it("never writes a limit of zero or a fraction", () => {
    expect(withRowLimit("select 1", 0)).toContain("limit 1");
    expect(withRowLimit("select 1", 10.7)).toContain("limit 10");
  });
});
