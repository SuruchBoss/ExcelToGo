import { afterEach, describe, expect, it } from "vitest";
import { assertConnectable, parseConnectionString } from "./dbGuard";
import { BlockedUrlError } from "./urlGuard";

const withAllowList = (hosts: string) => {
  process.env.SOURCES_ALLOWED_DB_HOSTS = hosts;
};

afterEach(() => {
  delete process.env.SOURCES_ALLOWED_DB_HOSTS;
});

const ok = (raw: string) => {
  const r = parseConnectionString(raw);
  if ("error" in r) throw new Error(`expected a target, got ${r.error}`);
  return r;
};
const err = (raw: string) => {
  const r = parseConnectionString(raw);
  return "error" in r ? r.error : "no_error";
};

describe("reading a connection string", () => {
  it("reads both spellings of Postgres and both of MySQL", () => {
    expect(ok("postgres://u:p@db.example.com/shop").kind).toBe("postgres");
    expect(ok("postgresql://u:p@db.example.com/shop").kind).toBe("postgres");
    expect(ok("mysql://u:p@db.example.com/shop").kind).toBe("mysql");
    expect(ok("mariadb://u:p@db.example.com/shop").kind).toBe("mysql");
  });

  it("fills in the port each one actually uses", () => {
    expect(ok("postgres://u:p@db.example.com/shop").port).toBe(5432);
    expect(ok("mysql://u:p@db.example.com/shop").port).toBe(3306);
    expect(ok("postgres://u:p@db.example.com:6543/shop").port).toBe(6543);
  });

  it("decodes a password with punctuation in it, which is most passwords", () => {
    expect(ok("postgres://u:p%40ss%3Aword@db.example.com/shop").password).toBe("p@ss:word");
  });

  it("refuses a scheme that is not a database", () => {
    // `file:` and `http:` here would be the same class of bug the URL guard exists for.
    expect(err("http://db.example.com/shop")).toBe("invalid_scheme");
    expect(err("file:///etc/passwd")).toBe("invalid_scheme");
    expect(err("not a url")).toBe("invalid_connection");
    expect(err("   ")).toBe("missing_connection");
  });

  it("refuses a unix socket, which would step around every address check by not using one", () => {
    // The dangerous spelling is the one that looks fine: a real host in the URL and a `host=`
    // parameter behind it, which the Postgres driver prefers over the host it was shown.
    expect(err("postgres://u:p@db.example.com/shop?host=/var/run/postgresql")).toBe("invalid_host");
    expect(err("postgres://u:p@%2Fvar%2Frun/shop")).toBe("invalid_host");
    expect(err("postgres://u:p@/shop")).toBe("invalid_connection");
  });

  it("refuses a string with no database named", () => {
    expect(err("postgres://u:p@db.example.com")).toBe("missing_database");
    expect(err("postgres://u:p@db.example.com/")).toBe("missing_database");
  });

  it("reads whether TLS was asked for", () => {
    expect(ok("postgres://u:p@db.example.com/shop?sslmode=require").ssl).toBe(true);
    expect(ok("mysql://u:p@db.example.com/shop?ssl=true").ssl).toBe(true);
    expect(ok("postgres://u:p@db.example.com/shop?sslmode=disable").ssl).toBe(false);
    expect(ok("postgres://u:p@db.example.com/shop").ssl).toBe(false);
  });
});

describe("which databases the server refuses to connect to", () => {
  it("refuses a literal private address, including the metadata one", async () => {
    for (const host of ["169.254.169.254", "127.0.0.1", "10.0.0.5", "[::1]"]) {
      await expect(assertConnectable(`postgres://u:p@${host}:5432/shop`)).rejects.toBeInstanceOf(BlockedUrlError);
    }
  });

  it("lets an operator allow a private host on purpose, which is the normal deployment", async () => {
    // A database inside a VPC is private by design; without this the feature would be unusable in
    // exactly the places it is for. The list lives in the environment, where only the operator
    // writes, so nothing a browser sends can add to it.
    withAllowList("db.internal");
    const target = await assertConnectable("postgres://u:p@db.internal:5432/shop");
    expect(target.host).toBe("db.internal");
    expect(target.allowListed).toBe(true);
  });

  it("does not let a near-miss on the allow list through", async () => {
    withAllowList("db.internal");
    await expect(assertConnectable("postgres://u:p@evil.db.internal:5432/shop")).rejects.toBeInstanceOf(
      BlockedUrlError
    );
  });

  it("carries the parse error out as a refusal rather than a crash", async () => {
    await expect(assertConnectable("http://db.example.com/shop")).rejects.toThrow("invalid_scheme");
  });

  it("refuses a name it cannot resolve rather than handing it to the driver", async () => {
    await expect(
      assertConnectable("postgres://u:p@nothing.invalid.exceltogo.test:5432/shop")
    ).rejects.toBeInstanceOf(BlockedUrlError);
  });
});
