// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it } from "vitest";
import { checkSourcesAuth, SOURCES_TOKEN_HEADER, sourcesEnabled } from "./sourcesAuth";

const req = (headers: Record<string, string> = {}) => new Request("https://x.test/api/sources", { headers });

afterEach(() => {
  delete process.env.SOURCES_ADMIN_TOKEN;
});

describe("with no token configured", () => {
  it("reports the feature as off", () => {
    expect(sourcesEnabled()).toBe(false);
  });

  it("refuses every request rather than leaving the API open", () => {
    // Failing closed is the whole point: these endpoints drive the server's HTTP client, so
    // "nobody configured a token" must mean "nobody gets in", not "everybody does".
    const denied = checkSourcesAuth(req());
    expect(denied?.status).toBe(403);
    expect(denied?.body.error).toBe("sources_disabled");
  });

  it("refuses even a request that carries some token", () => {
    expect(checkSourcesAuth(req({ [SOURCES_TOKEN_HEADER]: "anything" }))?.status).toBe(403);
  });

  it("treats a blank token as unset, which is what an empty env line produces", () => {
    process.env.SOURCES_ADMIN_TOKEN = "   ";
    expect(sourcesEnabled()).toBe(false);
    expect(checkSourcesAuth(req())?.body.error).toBe("sources_disabled");
  });
});

describe("with a token configured", () => {
  const token = "s3cret-operator-token";

  it("lets the right token through", () => {
    process.env.SOURCES_ADMIN_TOKEN = token;
    expect(checkSourcesAuth(req({ [SOURCES_TOKEN_HEADER]: token }))).toBeNull();
  });

  it("also accepts it as a bearer token, for curl and scripts", () => {
    process.env.SOURCES_ADMIN_TOKEN = token;
    expect(checkSourcesAuth(req({ authorization: `Bearer ${token}` }))).toBeNull();
  });

  it("turns away a request with no token", () => {
    process.env.SOURCES_ADMIN_TOKEN = token;
    const denied = checkSourcesAuth(req());
    expect(denied?.status).toBe(401);
    expect(denied?.body.error).toBe("unauthorized");
  });

  it("turns away a wrong token, including one that is merely a prefix", () => {
    process.env.SOURCES_ADMIN_TOKEN = token;
    for (const wrong of ["nope", token.slice(0, -1), token + "x", token.toUpperCase()]) {
      expect(checkSourcesAuth(req({ [SOURCES_TOKEN_HEADER]: wrong }))?.status).toBe(401);
    }
  });

  it("distinguishes 'switched off' from 'wrong token', so an operator can tell which", () => {
    process.env.SOURCES_ADMIN_TOKEN = token;
    expect(checkSourcesAuth(req())?.body.error).toBe("unauthorized");
    delete process.env.SOURCES_ADMIN_TOKEN;
    expect(checkSourcesAuth(req())?.body.error).toBe("sources_disabled");
  });
});
