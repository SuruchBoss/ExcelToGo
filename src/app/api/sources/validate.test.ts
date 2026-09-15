import { describe, expect, it } from "vitest";
import { parseSourceBody } from "./validate";

/** Wraps a plain object as the JSON Request body parseSourceBody expects. */
function body(obj: unknown): Request {
  return new Request("https://app.test/api/sources", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj),
  });
}

const base = { name: "src", type: "rest" as const };

describe("parseSourceBody URL rules", () => {
  it("accepts a genuine relative path (the app's own routes)", async () => {
    const r = await parseSourceBody(body({ ...base, url: "/api/demo/sales" }));
    expect("value" in r && r.value.url).toBe("/api/demo/sales");
  });

  it("accepts absolute http and https URLs", async () => {
    for (const url of ["http://example.com/data.csv", "https://api.example.com/v1/orders"]) {
      const r = await parseSourceBody(body({ ...base, url }));
      expect("value" in r && r.value.url).toBe(url);
    }
  });

  // Regression for the SSRF bypass: these all begin with a slash, so the old check let them
  // through to executeSource's "same origin, skip the guard" fast path, where new URL() resolved
  // them to a foreign host. A relative path is one leading slash and no second slash/backslash.
  it("rejects protocol-relative and backslash URLs that only look relative", async () => {
    for (const url of [
      "//169.254.169.254/latest/meta-data/",
      "//example.com/",
      "/\\169.254.169.254/",
      "/\\/evil.example/",
      "//app.test@169.254.169.254/",
    ]) {
      const r = await parseSourceBody(body({ ...base, url }));
      expect("error" in r ? r.error : "ACCEPTED").toBe("invalid_url");
    }
  });

  it("rejects non-http schemes and junk", async () => {
    for (const url of ["ftp://example.com/", "file:///etc/passwd", "javascript:alert(1)", "not a url", ""]) {
      const r = await parseSourceBody(body({ ...base, url }));
      expect("error" in r).toBe(true);
    }
  });
});
