/**
 * Encrypts the one secret this app stores: the auth header attached to a data source.
 *
 * It used to sit in `data/sources.json` in plain text, so anyone with read access to the host, a
 * backup, or a stray disk image had the API key. Encrypting it does not make that file safe to
 * publish — an attacker who can read the file can usually read the environment too — but it stops
 * the common, boring losses: a backup copied somewhere less guarded, a tarball pasted into a chat,
 * a snapshot restored onto a different machine.
 *
 * AES-256-GCM, so a tampered ciphertext fails to decrypt rather than quietly returning rubbish
 * that would then be sent as somebody's Authorization header.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const PREFIX = "enc.v1";
const IV_BYTES = 12;

export class MissingKeyError extends Error {
  constructor() {
    super("SOURCES_SECRET_KEY is not set, so a source credential cannot be stored. See SECURITY.md.");
    this.name = "MissingKeyError";
  }
}

/**
 * The key, as 32 bytes.
 *
 * Hashed rather than used raw so that any passphrase works and a short one can't produce an
 * undersized key — the failure mode of "accepts whatever length" is a key that looks configured
 * and isn't.
 */
function keyBytes(): Buffer | null {
  const raw = (process.env.SOURCES_SECRET_KEY ?? "").trim();
  if (!raw) return null;
  return createHash("sha256").update(raw, "utf8").digest();
}

export function hasSecretKey(): boolean {
  return keyBytes() !== null;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(`${PREFIX}:`);
}

export function encryptSecret(plain: string): string {
  const key = keyBytes();
  if (!key) throw new MissingKeyError();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [PREFIX, iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
}

/**
 * Reads a stored value back.
 *
 * A value with no marker is one written before this existed, and is returned as-is: refusing it
 * would break every source already configured, and silently blanking it would send an empty
 * Authorization header and produce a baffling 401 from the far end. It is re-encrypted the next
 * time the source is saved.
 */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const key = keyBytes();
  if (!key) throw new MissingKeyError();
  const [, ivB64, tagB64, bodyB64] = stored.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(bodyB64, "base64")), decipher.final()]).toString("utf8");
}
