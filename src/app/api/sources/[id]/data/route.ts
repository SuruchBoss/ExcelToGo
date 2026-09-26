// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { executeSource } from "@/lib/server/executeSource";
import { getSource, withSecret } from "@/lib/server/sourceRepo";
import { authFailureResponse, checkSourcesAuth } from "@/lib/server/sourcesAuth";
import { fetchErrorResponse } from "../../errorResponse";
import { DEMO_MODE, demoModeResponse } from "@/lib/demoMode";
import { demoLanguage, demoUrlIn, getDemoSource } from "@/lib/server/demoSources";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: RouteContext<"/api/sources/[id]/data">) {
  const { id } = await ctx.params;
  const lang = demoLanguage(new URL(request.url).searchParams.get("lang"));

  // On a public demo the only readable sources are the three built-ins, looked up by exact id.
  // They carry no credential, so `withSecret` would be a no-op, and their URLs are fixed in the
  // source tree — the visitor supplies an id, never a destination.
  if (DEMO_MODE) {
    const demo = getDemoSource(id);
    if (!demo) return demoModeResponse();
    try {
      return Response.json(await executeSource({ ...demo, url: demoUrlIn(demo.url, lang) }, new URL(request.url).origin));
    } catch (err) {
      return fetchErrorResponse(err);
    }
  }

  const denied = checkSourcesAuth(request);
  if (denied) return authFailureResponse(denied);
  const source = await getSource(id);
  if (!source) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    const secret = withSecret(source);
    const table = await executeSource({ ...secret, url: demoUrlIn(secret.url, lang) }, new URL(request.url).origin);
    return Response.json(table);
  } catch (err) {
    return fetchErrorResponse(err);
  }
}
