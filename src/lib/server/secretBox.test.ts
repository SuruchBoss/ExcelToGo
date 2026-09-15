import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hasSecretKey, isEncrypted, MissingKeyError } from "./secretBox";

afterEach(() => {
  delete process.env.SOURCES_SECRET_KEY;
});

describe("storing a source credential", () => {
  it("comes back as what went in", () => {
    process.env.SOURCES_SECRET_KEY = "a-passphrase";
    const secret = "Bearer sk-live-0123456789";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("does not leave the secret readable in what is written to disk", () => {
    process.env.SOURCES_SECRET_KEY = "a-passphrase";
    const stored = encryptSecret("Bearer sk-live-0123456789");
    expect(stored).not.toContain("sk-live");
    expect(isEncrypted(stored)).toBe(true);
  });

  it("produces a different ciphertext each time, so equal keys aren't visibly equal", () => {
    process.env.SOURCES_SECRET_KEY = "a-passphrase";
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("handles Thai and other non-ASCII credentials", () => {
    process.env.SOURCES_SECRET_KEY = "กุญแจ";
    expect(decryptSecret(encryptSecret("โทเคน-ทดสอบ"))).toBe("โทเคน-ทดสอบ");
  });

  it("refuses to encrypt with no key rather than storing plain text", () => {
    expect(hasSecretKey()).toBe(false);
    expect(() => encryptSecret("secret")).toThrow(MissingKeyError);
  });

  it("fails to decrypt under the wrong key instead of returning rubbish", () => {
    process.env.SOURCES_SECRET_KEY = "right-key";
    const stored = encryptSecret("Bearer real");
    process.env.SOURCES_SECRET_KEY = "wrong-key";
    expect(() => decryptSecret(stored)).toThrow();
  });

  it("detects tampering, so a edited ciphertext never becomes a header", () => {
    process.env.SOURCES_SECRET_KEY = "a-passphrase";
    const stored = encryptSecret("Bearer real");
    const parts = stored.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });
});

describe("credentials written before this existed", () => {
  it("are still readable, so existing setups keep working", () => {
    // Refusing them would break every source already configured; blanking them would send an empty
    // header and produce a baffling 401 from the far end.
    process.env.SOURCES_SECRET_KEY = "a-passphrase";
    expect(decryptSecret("Bearer plaintext-from-before")).toBe("Bearer plaintext-from-before");
  });

  it("are readable even with no key configured at all", () => {
    expect(decryptSecret("Bearer plaintext-from-before")).toBe("Bearer plaintext-from-before");
  });

  it("are not mistaken for encrypted ones", () => {
    expect(isEncrypted("Bearer plaintext")).toBe(false);
  });
});
