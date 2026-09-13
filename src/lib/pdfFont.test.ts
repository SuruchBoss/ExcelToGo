import { afterEach, describe, expect, it, vi } from "vitest";

function fakeDoc() {
  const calls: string[] = [];
  return {
    calls,
    addFileToVFS: (name: string) => calls.push(`vfs:${name}`),
    addFont: (_file: string, name: string) => calls.push(`font:${name}`),
    setFont: (name: string) => calls.push(`set:${name}`),
  };
}

/** The module caches the fetched font for the life of the page, which is right in a browser and
 *  would otherwise let one case here decide the next one's answer. */
async function freshModule() {
  vi.resetModules();
  return import("./pdfFont");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("embedding the Thai font", () => {
  it("registers it and switches the document to it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([0, 1, 0, 0, 9, 9]), { status: 200 })));
    const { registerThaiFont, THAI_FONT_NAME } = await freshModule();
    const doc = fakeDoc();
    expect(await registerThaiFont(doc)).toBe(true);
    expect(doc.calls).toContain(`font:${THAI_FONT_NAME}`);
    expect(doc.calls).toContain(`set:${THAI_FONT_NAME}`);
  });

  it("fetches the font once however many times it is exported", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([0, 1, 0, 0]), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const { registerThaiFont } = await freshModule();
    await registerThaiFont(fakeDoc());
    await registerThaiFont(fakeDoc());
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back rather than throwing when the font can't be fetched", async () => {
    // A PDF whose Thai is wrong is worse than one whose Thai is right, and far better than no PDF
    // and an error the user can do nothing about.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    const { registerThaiFont } = await freshModule();
    const doc = fakeDoc();
    expect(await registerThaiFont(doc)).toBe(false);
    expect(doc.calls).toEqual([]);
  });

  it("survives the fetch itself rejecting, not just a bad status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    const { registerThaiFont } = await freshModule();
    expect(await registerThaiFont(fakeDoc())).toBe(false);
  });

  it("tries again after a failure instead of caching the miss forever", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const { registerThaiFont } = await freshModule();
    expect(await registerThaiFont(fakeDoc())).toBe(false);

    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([0, 1, 0, 0]), { status: 200 })));
    expect(await registerThaiFont(fakeDoc())).toBe(true);
  });
});
