// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasKeptCopy, markCopyKept, subscribeKeptCopy } from "./keptCopy";
import { downloadBlob } from "./download";

function fakeStorage(fail = false) {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => {
      if (fail) throw new Error("blocked");
      return data.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (fail) throw new Error("blocked");
      data.set(k, v);
    },
  };
}

describe("keptCopy — the save status's dot until a copy has been exported (#129)", () => {
  beforeEach(() => {
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("localStorage", fakeStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("starts with no copy kept, and remembers one once marked", () => {
    expect(hasKeptCopy()).toBe(false);
    markCopyKept();
    expect(hasKeptCopy()).toBe(true);
  });

  it("tells subscribers, and stops once they unsubscribe", () => {
    const heard = vi.fn();
    const stop = subscribeKeptCopy(heard);
    markCopyKept();
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    markCopyKept();
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("keeps the dot where storage is refused — that browser is the likeliest to lose the work", () => {
    vi.stubGlobal("localStorage", fakeStorage(true));
    const heard = vi.fn();
    subscribeKeptCopy(heard);
    expect(() => markCopyKept()).not.toThrow();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(hasKeptCopy()).toBe(false);
  });

  it("is marked by every download, since every export goes through downloadBlob", () => {
    const anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("document", { createElement: () => anchor, body: { appendChild: vi.fn() } });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });
    downloadBlob(new Blob(["a"]), "a.csv");
    expect(anchor.click).toHaveBeenCalled();
    expect(hasKeptCopy()).toBe(true);
  });
});
