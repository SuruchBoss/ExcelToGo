// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { createSource, listSources, toPublic } from "@/lib/server/sourceRepo";
import { authFailureResponse, checkSourcesAuth } from "@/lib/server/sourcesAuth";
import { parseSourceBody } from "./validate";
import { DEMO_MODE, demoModeResponse } from "@/lib/demoMode";
import { DEMO_SOURCES } from "@/lib/server/demoSources";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // A public demo lists the three built-ins and nothing else: no token, and no touch of
  // data/sources.json, which a serverless host mounts read-only anyway.
  if (DEMO_MODE) return Response.json(DEMO_SOURCES.map(toPublic));
  const denied = checkSourcesAuth(request);
  if (denied) return authFailureResponse(denied);
  const sources = await listSources();
  return Response.json(sources.map(toPublic));
}

export async function POST(request: Request) {
  // Still refused, and this is the load-bearing half: read-only access to a fixed list is only
  // safe for as long as nothing can add to the list.
  if (DEMO_MODE) return demoModeResponse();
  const denied = checkSourcesAuth(request);
  if (denied) return authFailureResponse(denied);
  const parsed = await parseSourceBody(request);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const created = await createSource(parsed.value);
  return Response.json(toPublic(created), { status: 201 });
}
