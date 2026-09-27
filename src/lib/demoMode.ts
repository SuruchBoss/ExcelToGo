// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Whether this deployment offers **server-side** live sources — and nothing else (#109).
 *
 * There is no demo: the public site is the app people use. Everything runs in the browser — the
 * grid, the engine, import/export, and since #110 live sources too, fetched by the visitor's own
 * browser. The one thing a deployment decides is whether *its server* may also fetch sources for
 * people, which is a different kind of feature: the server fetches a URL on someone's behalf and
 * keeps a credential for it, so it sits behind `SOURCES_ADMIN_TOKEN` (see `SECURITY.md`).
 *
 * - No `SOURCES_ADMIN_TOKEN`: the server-source UI is not shown at all — no token box, no "switched
 *   off" message — and every `/api/sources*` route still refuses (`src/lib/server/sourcesAuth.ts`).
 * - `NEXT_PUBLIC_DEMO_MODE=1` is still read, for deployments that set it before this change, and it
 *   now means exactly one thing: server sources off, even with a token. It says nothing to users.
 *   Kept rather than removed so an old setting cannot silently turn a server feature *on*.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

/** Server-side only: read per request, because a deployment can set the token after the build. */
export function serverSourcesConfigured(): boolean {
  return !DEMO_MODE && Boolean(process.env.SOURCES_ADMIN_TOKEN?.trim());
}

/** The refusal every server-source route gives while they are switched off. */
export function demoModeResponse(): Response {
  return Response.json(
    {
      error: "server_sources_off",
      message: "Server-side live sources are switched off on this deployment. Connect your API from the browser instead.",
    },
    { status: 403 }
  );
}
