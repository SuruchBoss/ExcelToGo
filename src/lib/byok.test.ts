// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearKey, keySnapshot, looksLikeAnthropicKey, maskKey, readKey, saveKey, subscribeToKey } from "./byok";

/** A stand-in for `sessionStorage`, with a switch for the modes that throw instead of returning. */
function installStorage(mode: "ok" | "throws" = "ok") {
  const data = new Map<string, string>();
  const boom = () => {
    throw new DOMException("denied");
  };
  vi.stubGlobal("window", {
    sessionStorage:
      mode === "throws"
        ? { getItem: boom, setItem: boom, removeItem: boom }
        : {
            getItem: (k: string) => data.get(k) ?? null,
            setItem: (k: string, v: string) => void data.set(k, v),
            removeItem: (k: string) => void data.delete(k),
          },
  });
  return data;
}

const KEY = "sk-ant-api03-ZmFrZWtleWZvcnRlc3Rz1234";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("key shape", () => {
  it("accepts a well-formed Anthropic key", () => {
    expect(looksLikeAnthropicKey(KEY)).toBe(true);
  });

  it("accepts one with surrounding whitespace, because pasting picks it up", () => {
    expect(looksLikeAnthropicKey(`  ${KEY}\n`)).toBe(true);
  });

  it("rejects a key from somewhere else", () => {
    // Catching this here is the difference between a clear message and a 401 from Anthropic.
    expect(looksLikeAnthropicKey("sk-proj-abcdefghijklmnopqrst")).toBe(false);
  });

  it("rejects the prefix on its own", () => {
    expect(looksLikeAnthropicKey("sk-ant-")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(looksLikeAnthropicKey("")).toBe(false);
  });
});

describe("masking", () => {
  it("shows enough to recognise the key and not enough to use it", () => {
    const masked = maskKey(KEY);
    expect(masked).toContain("sk-ant-api");
    expect(masked).not.toContain(KEY.slice(10, 20));
    expect(masked.length).toBeLessThan(KEY.length);
  });

  it("does not reveal a short string at all", () => {
    expect(maskKey("sk-ant-")).toBe("•".repeat(7));
  });
});

describe("storage", () => {
  beforeEach(() => {
    installStorage();
    clearKey();
  });

  it("round-trips a key and trims it on the way in", () => {
    saveKey(`  ${KEY} `);
    expect(readKey()).toBe(KEY);
  });

  it("forgets it when cleared", () => {
    saveKey(KEY);
    clearKey();
    expect(readKey()).toBe("");
  });

  it("notifies subscribers on save and on clear", () => {
    const seen: string[] = [];
    const stop = subscribeToKey(() => seen.push(keySnapshot()));
    saveKey(KEY);
    clearKey();
    stop();
    saveKey(KEY);
    expect(seen).toEqual([KEY, ""]);
  });

  it("reports no key rather than throwing when storage is blocked", () => {
    // Private windows and blocked site data throw on access. The panel must still render.
    installStorage("throws");
    expect(() => readKey()).not.toThrow();
    expect(readKey()).toBe("");
    expect(() => saveKey(KEY)).not.toThrow();
    expect(() => clearKey()).not.toThrow();
  });
});

describe("on the server, where there is no window", () => {
  it("reports no key instead of crashing the render", () => {
    vi.stubGlobal("window", undefined);
    expect(readKey()).toBe("");
  });
});
