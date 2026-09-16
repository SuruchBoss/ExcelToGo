import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The AI route is the one endpoint in the app that can cost the operator money, and it takes no
 * token — deliberately, because making a visitor sign in to ask "how do I add up this column"
 * would defeat the point. That leaves exactly one thing between a public deployment and a bill:
 * this file.
 *
 * The rule under test is stronger than "the demo shouldn't have a key configured", because that
 * one lives in a person's memory and a hosting dashboard. It is: with the demo switch on, the
 * request must not reach Anthropic *even when a key is present*. So the SDK is mocked and the
 * assertion is on the constructor never being called, not on the shape of the reply.
 */
const anthropic = vi.hoisted(() => ({ constructed: 0, create: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: anthropic.create };
    constructor() {
      anthropic.constructed++;
    }
  },
}));

const post = async (body: unknown, ip: string) => {
  // Fresh module graph every time: both DEMO_MODE and the rate limiter's counters are module
  // scope, so a stale import would answer with the previous test's environment.
  vi.resetModules();
  const { POST } = await import("./route");
  const response = await POST(
    new Request("https://x.test/api/ai/formula", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    })
  );
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
};

const ask = { question: "รวมยอดขายทั้งหมด", selection: "C2:C11", locale: "th" };

beforeEach(() => {
  anthropic.constructed = 0;
  anthropic.create.mockReset();
  anthropic.create.mockResolvedValue({
    content: [{ type: "text", text: '{"formula":"=SUBTOTAL(9,C2:C11)","explanation":"รวมยอดขาย"}' }],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("with the public-demo switch on", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
  });

  it("does not call Anthropic even though a key is configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-should-never-be-used");
    const { body } = await post(ask, "203.0.113.1");
    expect(anthropic.constructed).toBe(0);
    expect(anthropic.create).not.toHaveBeenCalled();
    expect(body.source).toBe("heuristic");
  });

  it("still answers, because the fallback runs locally and costs nothing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-should-never-be-used");
    const { status, body } = await post(ask, "203.0.113.2");
    // Not a 403: unlike live data, this feature degrades instead of switching off.
    expect(status).toBe(200);
    // The heuristic's answer, which the mocked model would never give: proof of the path taken.
    expect(body.formula).toBe("=SUM(C2:C11)");
    expect(String(body.explanation).length).toBeGreaterThan(0);
  });

  it("refuses a request with no question before it refuses anything else", async () => {
    const { status, body } = await post({ locale: "th" }, "203.0.113.3");
    expect(status).toBe(400);
    expect(body.error).toBe("missing_question");
  });
});

describe("with the demo switch off", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
  });

  it("falls back to the heuristic when no key is configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { body } = await post(ask, "203.0.113.4");
    expect(anthropic.constructed).toBe(0);
    expect(body.source).toBe("heuristic");
  });

  it("asks the model when a key is configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-configured-by-the-operator");
    const { body } = await post(ask, "203.0.113.5");
    expect(anthropic.constructed).toBe(1);
    expect(body.source).toBe("ai");
    expect(body.formula).toBe("=SUBTOTAL(9,C2:C11)");
  });

  it("falls back rather than erroring when the model call fails", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-configured-by-the-operator");
    anthropic.create.mockRejectedValue(new Error("upstream down"));
    const console_ = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await post(ask, "203.0.113.6");
    expect(status).toBe(200);
    expect(body.source).toBe("heuristic");
    console_.mockRestore();
  });
});
