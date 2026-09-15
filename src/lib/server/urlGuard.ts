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

/** The IPv4 address inside an IPv4-mapped or IPv4-compatible IPv6 address, if it is one. */
function embeddedIpv4(groups: number[]): string | null {
  const leadingZero = groups.slice(0, 5).every((g) => g === 0);
  if (!leadingZero) return null;
  const isMapped = groups[5] === 0xffff;
  const isCompatible = groups[5] === 0;
  if (!isMapped && !isCompatible) return null;
  const [a, b] = [groups[6], groups[7]];
  if (isCompatible && a === 0 && b <= 1) return null; // "::" and "::1" are handled on their own
  return [a >> 8, a & 0xff, b >> 8, b & 0xff].join(".");
}

export function isBlockedAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return BLOCKED_V4.some((cidr) => inV4Range(address, cidr));
  if (version !== 6) return true; // Not an address at all — refuse rather than guess.

  const ip = address.toLowerCase().split("%")[0]; // drop any zone index
  if (ip === "::" || ip === "::1") return true;

  const groups = ipv6Groups(ip);
  if (!groups) return true; // Couldn't read it — refuse rather than assume it is safe.

  // An IPv4 address wearing an IPv6 hat, in any of its spellings. Missing this is the classic way
  // one of these filters gets walked straight past.
  const embedded = embeddedIpv4(groups);
  if (embedded) return isBlockedAddress(embedded);

  const first = groups[0];
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
