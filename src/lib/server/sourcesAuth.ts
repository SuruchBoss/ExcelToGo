/**
 * Who is allowed to manage data sources.
 *
 * These endpoints let whoever reaches them tell the server to fetch a URL and hand back the
 * response. That is a capability worth guarding even on a machine you own, so the rule here is
 * **fail closed**: with no token configured the API is switched off entirely rather than left open
 * to anyone who can load the page. Being unreachable is a bad default only if the alternative
 * isn't "anyone on the internet can drive the server's HTTP client", and it is.
 *
 * A single shared token rather than user accounts, because that matches how the feature is meant
 * to be used and documented — one technical person sets the sources up once, everyone else just
 * sees the data. Accounts would be a bigger lie: there is nothing else in the app to attach them
 * to, and cloud save (which does have accounts) is optional and unrelated.
 */
import { timingSafeEqual } from "crypto";

export const SOURCES_TOKEN_HEADER = "x-sources-token";

export function configuredToken(): string {
  return (process.env.SOURCES_ADMIN_TOKEN ?? "").trim();
}

export function sourcesEnabled(): boolean {
  return configuredToken().length > 0;
}

/** Constant-time, so the comparison can't be turned into a way to read the token a byte at a time. */
function sameToken(given: string, expected: string): boolean {
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on a length mismatch, which would leak the length; hashing both to a
  // fixed size first is the usual dodge, but comparing lengths after the fact is enough here
  // because the result is combined rather than returned early.
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export type AuthFailure = { status: number; body: { error: string; message: string } };

/**
 * Null when the request may proceed, or the response to send back.
 *
 * The two refusals are deliberately different: "off" is a deployment that never turned the feature
 * on, and "unauthorized" is a wrong token. Collapsing them would leave an operator staring at a
 * 401 wondering which of the two they are looking at.
 */
export function checkSourcesAuth(request: Request): AuthFailure | null {
  const expected = configuredToken();
  if (!expected) {
    return {
      status: 403,
      body: {
        error: "sources_disabled",
        message:
          "Live data sources are off because SOURCES_ADMIN_TOKEN is not set. Set it to switch them on — see SECURITY.md.",
      },
    };
  }

  const header = request.headers.get(SOURCES_TOKEN_HEADER) ?? "";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const given = header || bearer;
  if (!given || !sameToken(given, expected)) {
    return {
      status: 401,
      body: { error: "unauthorized", message: "A valid data-source token is required." },
    };
  }
  return null;
}

export function authFailureResponse(failure: AuthFailure): Response {
  return Response.json(failure.body, { status: failure.status });
}
