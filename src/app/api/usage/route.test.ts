import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { recordUsage, usageLogLine } from "@/lib/server/usageSink";

/**
 * The endpoint a stranger with `curl` reaches, rather than the one the browser politely uses.
 *
 * Counted as a security test. The browser's copy of the event list is a convenience; this is the
 * copy that has to hold.
 */
const post = (body: unknown, raw?: string) =>
  POST(
    new Request("https://app.test/api/usage", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Present on every real request whether anyone wants them or not. None are read.
        "x-forwarded-for": "203.0.113.9",
        "user-agent": "Mozilla/5.0 (a real browser)",
        referer: "https://somewhere.example/private-page?q=secret",
        cookie: "session=abc123",
      },
      body: raw ?? JSON.stringify(body),
    })
  );

const enable = () => {
  process.env.NEXT_PUBLIC_USAGE = "1";
};

afterEach(() => {
  delete process.env.NEXT_PUBLIC_USAGE;
  delete process.env.USAGE_SUPABASE_URL;
  delete process.env.USAGE_SUPABASE_KEY;
  vi.restoreAllMocks();
});

describe("what the endpoint accepts", () => {
  it("records a listed event", async () => {
    enable();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await post({ event: "app_opened" })).status).toBe(204);
    expect(log).toHaveBeenCalledWith(usageLogLine("app_opened"));
  });

  it("records nothing at all when the deployment did not switch it on", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await post({ event: "app_opened" })).status).toBe(204);
    expect(log).not.toHaveBeenCalled();
  });

  it("records nothing for a name that is not on the list", async () => {
    enable();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    for (const event of ["everything", "app_opened; drop table x", "=SUM(เงินเดือน)", 42, null]) {
      expect((await post({ event })).status).toBe(204);
    }
    expect(log).not.toHaveBeenCalled();
  });

  it("answers the same either way, so a prober learns nothing from the status", async () => {
    enable();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const known = await post({ event: "ai_asked" });
    const unknown = await post({ event: "not_an_event" });
    expect([known.status, unknown.status]).toEqual([204, 204]);
    expect([await known.text(), await unknown.text()]).toEqual(["", ""]);
  });

  it("does not fall over on a body that is not JSON", async () => {
    enable();
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await post(null, "not json at all")).status).toBe(204);
    expect((await post(null, "")).status).toBe(204);
  });

  it("ignores every extra field somebody tries to attach", async () => {
    // The point of a closed union is that adding a field next to it changes nothing.
    enable();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await post({ event: "file_exported", sheet: "เงินเดือน", cells: ["ก", "ข"], ip: "1.2.3.4" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(usageLogLine("file_exported"));
  });

  it("does not read an unbounded body from an unauthenticated endpoint", async () => {
    enable();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    // A megabyte of padding before the field: the slice cuts it, the parse fails, nothing is
    // recorded — and nothing is held in memory waiting to be parsed either.
    await post(null, JSON.stringify({ pad: "x".repeat(1_000_000), event: "app_opened" }));
    expect(log).not.toHaveBeenCalled();
  });
});

describe("where a counted event goes", () => {
  it("calls the one function the key is allowed to call, with only the event", async () => {
    const calls: { url: string; body: unknown; headers: Record<string, string> }[] = [];
    const fake = vi.fn((url: string, init: RequestInit) => {
      calls.push({
        url,
        body: JSON.parse(String(init.body)),
        headers: init.headers as Record<string, string>,
      });
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    await recordUsage("live_data_inserted", {
      url: "https://project.supabase.co/",
      key: "anon-key",
      fetch: fake as unknown as typeof fetch,
    });

    expect(calls[0].url).toBe("https://project.supabase.co/rest/v1/rpc/bump_usage");
    // No day: `current_date` in the database is the only clock involved.
    expect(calls[0].body).toEqual({ p_event: "live_data_inserted" });
    expect(calls[0].headers.apikey).toBe("anon-key");
  });

  it("falls back to one structured line a log drain can count", async () => {
    const lines: string[] = [];
    await recordUsage("formula_entered", { url: "", key: "", log: (l) => lines.push(l) });
    expect(lines).toEqual(["exceltogo.usage formula_entered"]);
  });

  it("stays quiet when the sink is down, rather than turning an export into a 500", async () => {
    const dead = vi.fn(() => Promise.reject(new Error("no route to host")));
    await expect(
      recordUsage("file_imported", { url: "https://p.supabase.co", key: "k", fetch: dead as unknown as typeof fetch })
    ).resolves.toBeUndefined();
  });

  it("writes nothing for an event that is not on the list, even called directly", async () => {
    const lines: string[] = [];
    await recordUsage("anything" as never, { url: "", key: "", log: (l) => lines.push(l) });
    expect(lines).toEqual([]);
  });
});
