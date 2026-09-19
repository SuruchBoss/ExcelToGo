import { describe, expect, it } from "vitest";
import { parseSourceBody } from "./validate";

/** Wraps a plain object as the JSON Request body parseSourceBody expects. */
function body(obj: unknown): Request {
  return new Request("https://app.test/api/sources", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj),
  });
}

const base = { name: "src", type: "rest" as const };

describe("parseSourceBody URL rules", () => {
  it("accepts a genuine relative path (the app's own routes)", async () => {
    const r = await parseSourceBody(body({ ...base, url: "/api/demo/sales" }));
    expect("value" in r && r.value.url).toBe("/api/demo/sales");
  });

  it("accepts absolute http and https URLs", async () => {
    for (const url of ["http://example.com/data.csv", "https://api.example.com/v1/orders"]) {
      const r = await parseSourceBody(body({ ...base, url }));
      expect("value" in r && r.value.url).toBe(url);
    }
  });

  // Regression for the SSRF bypass: these all begin with a slash, so the old check let them
  // through to executeSource's "same origin, skip the guard" fast path, where new URL() resolved
  // them to a foreign host. A relative path is one leading slash and no second slash/backslash.
  it("rejects protocol-relative and backslash URLs that only look relative", async () => {
    for (const url of [
      "//169.254.169.254/latest/meta-data/",
      "//example.com/",
      "/\\169.254.169.254/",
      "/\\/evil.example/",
      "//app.test@169.254.169.254/",
    ]) {
      const r = await parseSourceBody(body({ ...base, url }));
      expect("error" in r ? r.error : "ACCEPTED").toBe("invalid_url");
    }
  });

  it("rejects non-http schemes and junk", async () => {
    for (const url of ["ftp://example.com/", "file:///etc/passwd", "javascript:alert(1)", "not a url", ""]) {
      const r = await parseSourceBody(body({ ...base, url }));
      expect("error" in r).toBe(true);
    }
  });
});

describe("a database source, which names no URL at all", () => {
  const db = { name: "ยอดขาย", type: "postgres" as const, connection: "postgres://u:p@db.example.com/shop" };

  it("takes a connection string and a read-only query", async () => {
    const r = await parseSourceBody(body({ ...db, query: "select * from orders" }));
    expect("value" in r && r.value.connection).toBe("postgres://u:p@db.example.com/shop");
    expect("value" in r && r.value.query).toBe("select * from orders");
    // No URL is asked for and none is invented; the REST branch below is never reached.
    expect("value" in r && r.value.url).toBe("");
  });

  it("refuses a query that is not a read, before anything is saved", async () => {
    const r = await parseSourceBody(body({ ...db, query: "delete from orders" }));
    expect("error" in r && r.error).toBe("query_notASelect");
    const two = await parseSourceBody(body({ ...db, query: "select 1; drop table orders" }));
    expect("error" in two && two.error).toBe("query_multipleStatements");
  });

  it("refuses a connection string that is not one", async () => {
    const r = await parseSourceBody(body({ ...db, connection: "http://db.example.com/shop", query: "select 1" }));
    expect("error" in r && r.error).toBe("invalid_scheme");
    const socket = await parseSourceBody(
      body({ ...db, connection: "postgres://u:p@db.example.com/shop?host=/var/run", query: "select 1" })
    );
    expect("error" in socket && socket.error).toBe("invalid_host");
  });

  it("refuses a MySQL string saved as a Postgres source", async () => {
    // Otherwise the driver picked and the protocol spoken disagree, and the error the operator
    // gets back is about a handshake rather than about the thing they typed.
    const r = await parseSourceBody(
      body({ name: "x", type: "mysql", connection: "postgres://u:p@db.example.com/shop", query: "select 1" })
    );
    expect("error" in r && r.error).toBe("scheme_type_mismatch");
  });

  it("lets the stored connection stand when the form sends back the mask", async () => {
    const r = await parseSourceBody(
      body({ ...db, connection: "postgres://••••••••@db.example.com/shop", query: "select 1" })
    );
    // Not an error: the repo resolves the mask to the stored ciphertext, and checking the shape of
    // a row of dots would fail every edit that only changed the query.
    expect("value" in r).toBe(true);
  });

  it("does not carry a REST source's fields into a database one", async () => {
    const r = await parseSourceBody(
      body({ ...db, query: "select 1", jsonPath: "data.items", authHeader: { name: "Authorization", value: "Bearer x" } })
    );
    expect("value" in r && r.value.jsonPath).toBeUndefined();
    expect("value" in r && r.value.authHeader).toBeUndefined();
  });
});
