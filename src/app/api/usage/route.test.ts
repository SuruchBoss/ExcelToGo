import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { failureReason, recordUsage, usageFailureLine, usageLogLine } from "@/lib/server/usageSink";

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

  it("never turns a dead sink into a 500 on the page", async () => {
    const dead = vi.fn(() => Promise.reject(new Error("no route to host")));
    await expect(
      recordUsage("file_imported", {
        url: "https://p.supabase.co",
        key: "k",
        fetch: dead as unknown as typeof fetch,
        warn: () => {},
      })
    ).resolves.toBeUndefined();
  });

  it("writes nothing for an event that is not on the list, even called directly", async () => {
    const lines: string[] = [];
    await recordUsage("anything" as never, { url: "", key: "", log: (l) => lines.push(l) });
    expect(lines).toEqual([]);
  });
});

/**
 * The half that was missing, and the reason a broken deployment took ten rounds to explain.
 *
 * Every case below used to produce the same nothing: no line, no error, 204 to the browser and an
 * empty table. The endpoint still answers 204 in all of them — that part was right — but the server
 * now says which one happened, in one line, on a channel a host can filter by level.
 */
describe("when the write does not land", () => {
  // 204 may not carry a body; `new Response("{}", { status: 204 })` throws, which is its own
  // little lesson about writing a "success" fixture without running it.
  const answering = (status: number) =>
    vi.fn(() => Promise.resolve(new Response(status === 204 ? null : "{}", { status })));

  // Not named `fetch`: a parameter by that name shadows the global, and `typeof fetch` below then
  // means `unknown` rather than the thing being stubbed.
  const record = (event: Parameters<typeof recordUsage>[0], send: unknown, warned: string[]) =>
    recordUsage(event, {
      url: "https://p.supabase.co",
      key: "k",
      fetch: send as typeof fetch,
      warn: (line) => warned.push(line),
    });

  it("says so when the key the host applied is not one the project accepts", async () => {
    const warned: string[] = [];
    await record("app_opened", answering(401), warned);
    expect(warned).toEqual([usageFailureLine("app_opened", "http_401")]);
  });

  it("tells a missing migration apart from a rejected key", async () => {
    const warned: string[] = [];
    await record("app_opened", answering(404), warned);
    // The two are one character apart in the line and a week apart in what you do about them.
    expect(warned).toEqual([usageFailureLine("app_opened", "http_404")]);
  });

  it("stays quiet when the write actually lands", async () => {
    const warned: string[] = [];
    await record("app_opened", answering(204), warned);
    expect(warned).toEqual([]);
  });

  it("names the reason a throw gives, by its code", async () => {
    const warned: string[] = [];
    const refused = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    });
    await record("ai_asked", vi.fn(() => Promise.reject(refused)), warned);
    expect(warned).toEqual([usageFailureLine("ai_asked", "ECONNREFUSED")]);
  });

  it("falls back to the error's name when there is no code to give", async () => {
    const warned: string[] = [];
    await record("ai_asked", vi.fn(() => Promise.reject(new TypeError("fetch failed"))), warned);
    expect(warned).toEqual([usageFailureLine("ai_asked", "TypeError")]);
  });

  it("carries the event, so a drain can still recover the count from the failure", async () => {
    const warned: string[] = [];
    await record("file_exported", answering(500), warned);
    expect(warned[0]).toContain("file_exported");
  });

  it("puts nothing in the line that an error was free to choose", () => {
    // The one function in this codebase that holds an API key is the one whose errors get printed,
    // so a reason is a token or it is `unknown`. `Error` coming back from a thrown `Error` whose
    // *code* was a connection string is the whole point: the token survives, the string does not.
    const secret = "sb_secret_abc";
    const leaky: unknown[] = [
      Object.assign(new Error("x"), { code: `postgres://user:hunter2@db.internal:5432/app` }),
      Object.assign(new Error("x"), { code: `has spaces and a key ${secret}` }),
      Object.assign(new Error("x"), { code: "A".repeat(33) }),
      Object.assign(new Error("x"), { code: 42 }),
      Object.assign(new Error("x"), { name: `Error: apikey=${secret}` }),
      Object.assign(new TypeError("fetch failed"), { cause: { code: `apikey ${secret}` } }),
      new Error(`https://project.supabase.co/rest/v1/rpc/bump_usage?apikey=${secret}`),
      "https://project.supabase.co/rest/v1/rpc/bump_usage",
      { message: secret },
      null,
      undefined,
    ];
    for (const error of leaky) {
      const reason = failureReason(error);
      expect(reason).toMatch(/^[A-Za-z0-9_]{1,32}$/);
      expect(reason).not.toContain(secret);
      expect(usageFailureLine("app_opened", reason)).not.toContain(secret);
    }
  });

  it("carries the complaint all the way out of the endpoint, not just out of the sink", async () => {
    // Through the route, with the environment the deployment actually had: the sink reads its URL
    // and key once at import, so this is the only way to test the wiring rather than the function.
    vi.resetModules();
    process.env.NEXT_PUBLIC_USAGE = "1";
    process.env.USAGE_SUPABASE_URL = "https://p.supabase.co";
    process.env.USAGE_SUPABASE_KEY = "a-key-the-host-never-applied";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", answering(401));

    const route = await import("./route");
    const res = await route.POST(
      new Request("https://app.test/api/usage", { method: "POST", body: JSON.stringify({ event: "app_opened" }) })
    );

    // The browser is still told nothing — that part was never the bug.
    expect(res.status).toBe(204);
    // The server is no longer telling *itself* nothing, which was.
    expect(warn).toHaveBeenCalledWith(usageFailureLine("app_opened", "http_401"));
    vi.unstubAllGlobals();
    vi.resetModules();
  });
});
