import { beforeEach, describe, expect, it } from "vitest";
import { describeConnection, MASK, toPublic } from "./sourceRepo";
import { encryptSecret } from "./secretBox";
import { DataSourceConfig } from "@/lib/dataSources/types";

/**
 * What the browser is allowed to know about a source.
 *
 * Counted as a security test: a connection string holds a database password, and the panel's only
 * legitimate need is to say *which* database a source points at.
 */
beforeEach(() => {
  process.env.SOURCES_SECRET_KEY = "0".repeat(64);
});

const source = (over: Partial<DataSourceConfig> = {}): DataSourceConfig => ({
  id: "src-1",
  name: "ยอดขาย",
  type: "postgres",
  url: "",
  refreshSec: 30,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("what leaves the server", () => {
  it("never sends the connection string, only a description of it", () => {
    const stored = source({ connection: encryptSecret("postgres://admin:hunter2@db.example.com:5432/shop") });
    const pub = toPublic(stored);
    const json = JSON.stringify(pub);

    expect(json).not.toContain("hunter2");
    expect(json).not.toContain("admin");
    expect(pub.connection).toBe(`postgres://${MASK}@db.example.com/shop`);
  });

  it("keeps a non-default port, because that is part of which database it is", () => {
    const stored = source({ connection: encryptSecret("postgres://u:p@db.example.com:6543/shop") });
    expect(toPublic(stored).connection).toBe(`postgres://${MASK}@db.example.com:6543/shop`);
  });

  it("drops the default port, which is noise", () => {
    const mysql = source({ type: "mysql", connection: encryptSecret("mysql://u:p@db.example.com:3306/shop") });
    expect(toPublic(mysql).connection).toBe(`mysql://${MASK}@db.example.com/shop`);
  });

  it("says nothing rather than guessing when the stored string cannot be read", () => {
    // A wrong key, a truncated file, a hand-edited entry. Leaking half a credential to say
    // something reassuring is the wrong trade in exactly this place.
    expect(describeConnection("not-ciphertext")).toBe(MASK);
    expect(describeConnection(encryptSecret("not a connection string"))).toBe(MASK);
  });

  it("still masks an auth header, and still sends everything that is not a secret", () => {
    const pub = toPublic(
      source({ type: "rest", url: "https://api.example.com/x", authHeader: { name: "Authorization", value: encryptSecret("Bearer s3cret") } })
    );
    expect(JSON.stringify(pub)).not.toContain("s3cret");
    expect(pub.authHeader).toEqual({ name: "Authorization", value: MASK, masked: true });
    expect(pub.url).toBe("https://api.example.com/x");
    expect(pub.connection).toBeUndefined();
  });
});
