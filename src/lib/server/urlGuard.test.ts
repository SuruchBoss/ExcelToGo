// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { assertFetchable, BlockedUrlError, isBlockedAddress } from "./urlGuard";

describe("which addresses the server refuses to reach", () => {
  it("blocks loopback", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("127.255.255.254")).toBe(true);
    expect(isBlockedAddress("::1")).toBe(true);
  });

  it("blocks the cloud metadata address, which is the whole point", () => {
    // 169.254.169.254 is the metadata endpoint on AWS, GCP and Azure; reading it is how a
    // request-forgery bug turns into stolen credentials.
    expect(isBlockedAddress("169.254.169.254")).toBe(true);
  });

  it("blocks the private ranges", () => {
    for (const ip of ["10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1"]) {
      expect(isBlockedAddress(ip)).toBe(true);
    }
  });

  it("does not over-block the neighbours of a private range", () => {
    // 172.15/16 and 172.32/16 sit either side of 172.16/12 and are ordinary public space.
    for (const ip of ["172.15.0.1", "172.32.0.1", "11.0.0.1", "9.255.255.255"]) {
      expect(isBlockedAddress(ip)).toBe(false);
    }
  });

  it("blocks an IPv4 address wearing an IPv6 hat", () => {
    // ::ffff:127.0.0.1 is the classic way a filter like this gets walked straight past.
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isBlockedAddress("::FFFF:10.0.0.1")).toBe(true);
  });

  it("blocks the hex spelling of a mapped address, which is what a URL normalises to", () => {
    // new URL("http://[::ffff:169.254.169.254]/") rewrites the host as ::ffff:a9fe:a9fe. A check
    // that only knew the dotted form would wave the metadata service straight through.
    expect(isBlockedAddress("::ffff:a9fe:a9fe")).toBe(true); // 169.254.169.254
    expect(isBlockedAddress("::ffff:7f00:1")).toBe(true); // 127.0.0.1
    expect(isBlockedAddress("::ffff:c0a8:1")).toBe(true); // 192.168.0.1
  });

  it("blocks the deprecated IPv4-compatible form too", () => {
    expect(isBlockedAddress("::a9fe:a9fe")).toBe(true); // 169.254.169.254
    expect(isBlockedAddress("::7f00:1")).toBe(true); // 127.0.0.1
  });

  it("does not mistake an ordinary public address for a mapped one", () => {
    expect(isBlockedAddress("::ffff:808:808")).toBe(false); // 8.8.8.8
    expect(isBlockedAddress("2001:4860:4860::8888")).toBe(false);
  });

  it("blocks IPv6 link-local and unique-local, zone index and all", () => {
    expect(isBlockedAddress("fe80::1")).toBe(true);
    expect(isBlockedAddress("fe80::1%eth0")).toBe(true);
    expect(isBlockedAddress("fd00::1")).toBe(true);
    expect(isBlockedAddress("fc00::1")).toBe(true);
  });

  it("blocks multicast, broadcast and 'this network'", () => {
    expect(isBlockedAddress("0.0.0.0")).toBe(true);
    expect(isBlockedAddress("224.0.0.1")).toBe(true);
    expect(isBlockedAddress("255.255.255.255")).toBe(true);
    expect(isBlockedAddress("ff02::1")).toBe(true);
  });

  it("allows ordinary public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700::1111"]) {
      expect(isBlockedAddress(ip)).toBe(false);
    }
  });

  it("refuses anything that isn't an address rather than guessing", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
  });
});

describe("checking a URL before fetching it", () => {
  const rejects = async (url: string) => {
    await expect(assertFetchable(url)).rejects.toBeInstanceOf(BlockedUrlError);
  };

  it("refuses schemes that are not http or https", async () => {
    // file: and data: have both been used to read a server's own disk through a fetcher.
    for (const url of ["file:///etc/passwd", "data:text/plain,hi", "gopher://x/", "ftp://example.com/"]) {
      await rejects(url);
    }
  });

  it("refuses something that isn't a URL at all", async () => {
    await rejects("not a url");
  });

  it("refuses a literal private address without needing DNS", async () => {
    await rejects("http://127.0.0.1:8080/admin");
    await rejects("http://169.254.169.254/latest/meta-data/");
  });

  it("sees through the brackets on an IPv6 literal", async () => {
    // new URL().hostname keeps them, so without unwrapping, "[::1]" isn't an address to net.isIP
    // and skips the address check entirely — blocked only by a DNS lookup that happens to fail.
    await expect(assertFetchable("http://[::1]:3000/")).rejects.toThrow(/not a public address/);
    await expect(assertFetchable("http://[fd00::1]/")).rejects.toThrow(/not a public address/);
    await expect(assertFetchable("http://[::ffff:169.254.169.254]/")).rejects.toThrow(/not a public address/);
  });

  it("lets a public IPv6 literal through", async () => {
    await expect(assertFetchable("https://[2606:4700::1111]/x")).resolves.toMatchObject({
      addresses: ["2606:4700::1111"],
    });
  });

  it("refuses a host that cannot be resolved", async () => {
    await rejects("https://this-host-should-not-exist.invalid/data");
  });

  it("reports which address it objected to, so an operator can tell what happened", async () => {
    await expect(assertFetchable("http://127.0.0.1/x")).rejects.toThrow(/127\.0\.0\.1/);
  });
});

describe("an allowlist, when a deployment sets one", () => {
  it("refuses a host that isn't on it", async () => {
    process.env.SOURCES_ALLOWED_HOSTS = "api.example.com, data.example.com";
    try {
      await expect(assertFetchable("https://evil.example.org/x")).rejects.toThrow(/SOURCES_ALLOWED_HOSTS/);
    } finally {
      delete process.env.SOURCES_ALLOWED_HOSTS;
    }
  });

  it("still applies the address checks to a host that is on it", async () => {
    // Being allowlisted is not a licence to point at loopback.
    process.env.SOURCES_ALLOWED_HOSTS = "localhost";
    try {
      await expect(assertFetchable("http://localhost:3000/x")).rejects.toBeInstanceOf(BlockedUrlError);
    } finally {
      delete process.env.SOURCES_ALLOWED_HOSTS;
    }
  });
});
