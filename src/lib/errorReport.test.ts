import { describe, expect, it, vi } from "vitest";
import { buildReport, isReportingConfigured, scrub, sendReport } from "./errorReport";

/**
 * A crash reporter in an app whose whole promise is "your file never leaves the browser" has to be
 * held to what it sends, not to what it means to send. These tests are that.
 */
describe("whether anything is sent at all", () => {
  it("is off when no endpoint is configured, which is every deployment by default", () => {
    expect(isReportingConfigured("")).toBe(false);
    expect(isReportingConfigured("   ")).toBe(false);
  });

  it("is on only once somebody sets one", () => {
    expect(isReportingConfigured("https://errors.example/collect")).toBe(true);
  });

  it("sends nothing, and says so, when it is off", () => {
    const beacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    expect(sendReport(buildReport({}, { path: "/app", userAgent: "x" }), "")).toBe(false);
    expect(beacon).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("uses a beacon, because the page is often about to be reloaded", () => {
    // A fetch in flight when the person presses reload is a report that never arrives.
    const beacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    expect(sendReport(buildReport({}, { path: "/app", userAgent: "x" }), "https://errors.example")).toBe(true);
    expect(beacon).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("swallows a failing endpoint rather than crashing the crash screen", () => {
    vi.stubGlobal("navigator", {
      sendBeacon: () => {
        throw new Error("blocked");
      },
    });
    expect(sendReport(buildReport({}, { path: "/app", userAgent: "x" }), "https://errors.example")).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe("what a report is allowed to contain", () => {
  it("keeps the path and drops the query string", () => {
    // A query string is user input, and user input is the thing not to send.
    const report = buildReport({ message: "boom" }, { path: "/app?sheet=เงินเดือน&row=4", userAgent: "x" });
    expect(report.path).toBe("/app");
  });

  it("carries the digest, so a report can be matched to a server log", () => {
    expect(buildReport({ message: "x", digest: "1234567890" }, { path: "/", userAgent: "x" }).digest).toBe("1234567890");
  });

  it("has no digest field at all when there is none", () => {
    expect(buildReport({ message: "x" }, { path: "/", userAgent: "x" })).not.toHaveProperty("digest");
  });

  it("is a fixed set of fields, not whatever the error object happened to carry", () => {
    const report = buildReport(
      { message: "x", stack: "at f", digest: "d" } as Record<string, unknown> & { message: string },
      { path: "/", userAgent: "x", at: "2026-01-01T00:00:00.000Z" }
    );
    expect(Object.keys(report).sort()).toEqual(["at", "digest", "message", "path", "stack", "userAgent"]);
  });

  it("caps a message and a stack, so one report cannot be a data channel", () => {
    const report = buildReport({ message: "x".repeat(5_000), stack: "y".repeat(50_000) }, { path: "/", userAgent: "x" });
    expect(report.message.length).toBeLessThanOrEqual(300);
    expect(report.stack.length).toBeLessThanOrEqual(4_000);
  });
});

describe("what is taken out on the way", () => {
  it("removes an Anthropic key, which is one throw away from a crash report", () => {
    const out = scrub("Bad request with key sk-ant-api03-AAAABBBBCCCC in header");
    expect(out).not.toContain("sk-ant-api03-AAAABBBBCCCC");
    expect(out).toContain("sk-ant-[removed]");
  });

  it("removes a token in the shape Supabase hands out", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(scrub(`Authorization: Bearer ${jwt}`)).not.toContain(jwt);
  });

  it("removes an email address", () => {
    expect(scrub("signInWithOtp failed for somchai@example.com")).not.toContain("somchai@example.com");
  });

  it("removes Thai text, which in this app is the user's data and not the code", () => {
    // `#NAME?` inside `=ยอดขายสาขาเหนือ(...)` is the spreadsheet's content sitting in a stack trace.
    const out = scrub("Unknown function ยอดขายสาขาเหนือ at evaluate (formula.ts:12)");
    expect(out).not.toContain("ยอดขายสาขาเหนือ");
    expect(out).toContain("evaluate (formula.ts:12)");
  });

  it("scrubs the stack as well as the message, not only the part people look at", () => {
    const report = buildReport(
      { message: "failed", stack: "at send (byok.ts:3) key=sk-ant-api03-SECRETVALUE" },
      { path: "/", userAgent: "x" }
    );
    expect(report.stack).not.toContain("SECRETVALUE");
  });

  it("leaves an ordinary stack readable, or the report is worth nothing", () => {
    const stack = "TypeError: x is not a function\n    at compute (sheetCompute.ts:412:9)";
    expect(scrub(stack)).toBe(stack);
  });
});
