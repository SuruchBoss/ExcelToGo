// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Decides whether the server is allowed to fetch a URL a user typed in.
 *
 * A data source names a URL and the *server* fetches it. Without this, pointing one at
 * `http://169.254.169.254/latest/meta-data/` hands back the cloud instance's credentials in a
 * spreadsheet, and pointing it at an internal admin service reaches straight past the firewall.
 * That is server-side request forgery, and on a hosted deployment it is the most serious thing
 * this app could get wrong.
 *
 * Two things make it harder than "reject localhost":
 *
 *  - A hostname is not an address. `evil.test` can resolve to 127.0.0.1, so the check has to run
 *    on what DNS actually returns, not on the text of the URL.
 *  - A redirect changes the destination after the check. Every hop is re-checked, which is why the
 *    fetcher follows redirects itself instead of letting fetch() do it.
 */
import { promises as dns } from "dns";
import net from "net";

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

/** When set, the only hosts a source may point at. Empty means "anything public". */
function allowedHosts(): string[] {
  return (process.env.SOURCES_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function ipv4ToLong(ip: string): number {
  return ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);
}

function inV4Range(ip: string, cidr: string): boolean {
  const [base, bitsText] = cidr.split("/");
  const bits = Number(bitsText);
  const mask = bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0;
  return (ipv4ToLong(ip) & mask) >>> 0 === (ipv4ToLong(base) & mask) >>> 0;
}

/**
 * Everything that is not the public internet.
 *
 * 169.254.0.0/16 is the one that matters most: 169.254.169.254 is the metadata endpoint on AWS,
 * GCP and Azure alike, and reading it is how a request-forgery bug turns into stolen credentials.
 */
const BLOCKED_V4 = [
  "0.0.0.0/8", // "this network"
  "10.0.0.0/8", // private
  "100.64.0.0/10", // carrier-grade NAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local, including cloud metadata
  "172.16.0.0/12", // private
  "192.0.0.0/24", // IETF protocol assignments
  "192.0.2.0/24", // documentation
  "192.168.0.0/16", // private
  "198.18.0.0/15", // benchmarking
  "198.51.100.0/24", // documentation
  "203.0.113.0/24", // documentation
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved, includes broadcast
];

/**
 * The eight 16-bit groups of an IPv6 address, with "::" filled back in.
 *
 * Needed because the same address has several spellings and the dangerous ones are not the
 * spelling anybody types: `new URL()` rewrites `::ffff:169.254.169.254` as `::ffff:a9fe:a9fe`, so
 * a check that only recognised the dotted form would wave the metadata service straight through.
 */
function ipv6Groups(ip: string): number[] | null {
  const [head, tail, ...rest] = ip.split("::");
  if (rest.length > 0) return null; // "::" may appear once
  const parse = (part: string) => (part === "" ? [] : part.split(":"));
  const left = parse(head);
  const right = tail === undefined ? [] : parse(tail);
  const missing = 8 - left.length - right.length;
  if (tail === undefined ? left.length !== 8 : missing < 0) return null;
  const groups = [...left, ...Array(tail === undefined ? 0 : missing).fill("0"), ...right];
  const out = groups.map((g) => parseInt(g, 16));
  return out.length === 8 && out.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? out : null;
}

const dotted = (a: number, b: number) => [a >> 8, a & 0xff, b >> 8, b & 0xff].join(".");

/**
 * The IPv4 address an IPv6 address carries, for the five forms that carry one where it can be read.
 *
 * - IPv4-mapped `::ffff:a.b.c.d` and IPv4-compatible `::a.b.c.d` — the last 32 bits.
 * - SIIT "IPv4-translated" `::ffff:0:a.b.c.d` (`::ffff:0:0/96`, RFC 6145) — the last 32 bits. The
 *   same address as the mapped form one group over, and a translator treats it as the IPv4 one.
 * - NAT64 well-known prefix `64:ff9b::/96` (RFC 6052) — the last 32 bits. On an IPv6-only subnet
 *   the gateway turns this into a real IPv4 connection, so `64:ff9b::a9fe:a9fe` *is*
 *   169.254.169.254 to the host that sends it.
 * - 6to4 `2002::/16` (RFC 3056) — bits 16–47, the two groups after the prefix.
 *
 * Decoded rather than refused outright so a public IPv4 address reached through NAT64 still works,
 * which is the only way an IPv6-only host can reach one at all.
 */
function embeddedIpv4(groups: number[]): string | null {
  if (groups[0] === 0x2002) return dotted(groups[1], groups[2]);
  const nat64 = groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((g) => g === 0);
  if (nat64) return dotted(groups[6], groups[7]);

  const translated = groups.slice(0, 4).every((g) => g === 0) && groups[4] === 0xffff && groups[5] === 0;
  if (translated) return dotted(groups[6], groups[7]);

  const leadingZero = groups.slice(0, 5).every((g) => g === 0);
  if (!leadingZero) return null;
  const isMapped = groups[5] === 0xffff;
  const isCompatible = groups[5] === 0;
  if (!isMapped && !isCompatible) return null;
  const [a, b] = [groups[6], groups[7]];
  if (isCompatible && a === 0 && b <= 1) return null; // "::" and "::1" are handled on their own
  return dotted(a, b);
}

export function isBlockedAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return BLOCKED_V4.some((cidr) => inV4Range(address, cidr));
  if (version !== 6) return true; // Not an address at all — refuse rather than guess.

  const ip = address.toLowerCase().split("%")[0]; // drop any zone index
  if (ip === "::" || ip === "::1") return true;

  const groups = ipv6Groups(ip);
  if (!groups) return true; // Couldn't read it — refuse rather than assume it is safe.

  // An IPv4 address wearing an IPv6 hat, in each of the forms listed on `embeddedIpv4`. Missing
  // one is the classic way these filters get walked straight past.
  const embedded = embeddedIpv4(groups);
  if (embedded) return isBlockedAddress(embedded);

  const first = groups[0];
  // 64:ff9b:1::/48, NAT64 for local use (RFC 8215). Where the IPv4 sits inside it depends on the
  // prefix length the operator chose, which the address does not say — so it cannot be decoded,
  // and a prefix that exists only for an operator's own network has no business in a source URL.
  if (first === 0x64 && groups[1] === 0xff9b && groups[2] === 1) return true;
  if (first === 0x2001 && groups[1] === 0x0db8) return true; // 2001:db8::/32 documentation
  // 2001::/32, Teredo (RFC 4380). It carries an IPv4 address too, but obscured, and the protocol has
  // been switched off almost everywhere — so the whole prefix is refused rather than decoded.
  if (first === 0x2001 && groups[1] === 0) return true;
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

export interface UrlCheck {
  url: URL;
  /** The addresses DNS returned, which are what was actually judged. */
  addresses: string[];
}

/**
 * Throws unless the server may fetch this URL.
 *
 * Resolving here means the address that gets checked and the address that gets connected to can
 * still differ — the name could be re-resolved between the two. Closing that completely needs the
 * connection pinned to the address, which Node's fetch does not expose; this raises the bar a very
 * long way without pretending to be airtight, and SECURITY.md says so.
 */
export async function assertFetchable(rawUrl: string): Promise<UrlCheck> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError("That is not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    // file:, data: and gopher: have all been used to read a server's own disk through a fetcher.
    throw new BlockedUrlError(`Only http and https are allowed, not ${url.protocol.replace(":", "")}.`);
  }

  const allow = allowedHosts();
  if (allow.length > 0 && !allow.includes(url.hostname.toLowerCase())) {
    throw new BlockedUrlError(`${url.hostname} is not in SOURCES_ALLOWED_HOSTS.`);
  }

  // `new URL("http://[::1]/").hostname` keeps the brackets, so the literal has to be unwrapped
  // before it looks like an address — otherwise an IPv6 literal skips the address check entirely
  // and is judged by a DNS lookup that was never going to succeed.
  const host = url.hostname.replace(/^\[|\]$/g, "");

  let addresses: string[];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw new BlockedUrlError(`Could not resolve ${host}.`);
    }
  }
  if (addresses.length === 0) throw new BlockedUrlError(`Could not resolve ${host}.`);

  // Every address, not just the first: a name that resolves to one public and one private address
  // would otherwise be a coin toss decided by whichever the connection happens to pick.
  const blocked = addresses.find(isBlockedAddress);
  if (blocked) {
    throw new BlockedUrlError(`${host} resolves to ${blocked}, which is not a public address.`);
  }

  return { url, addresses };
}
