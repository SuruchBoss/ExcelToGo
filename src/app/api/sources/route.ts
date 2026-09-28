// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { createSource, listSources, toPublic } from "@/lib/server/sourceRepo";
import { authFailureResponse, checkSourcesAuth } from "@/lib/server/sourcesAuth";
import { parseSourceBody } from "./validate";
import { DEMO_MODE, demoModeResponse } from "@/lib/demoMode";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Server sources switched off (#109): nothing to list, and data/sources.json is not touched.
  if (DEMO_MODE) return demoModeResponse();
  const denied = checkSourcesAuth(request);
  if (denied) return authFailureResponse(denied);
  const sources = await listSources();
  return Response.json(sources.map(toPublic));
}

export async function POST(request: Request) {
  if (DEMO_MODE) return demoModeResponse();
  const denied = checkSourcesAuth(request);
  if (denied) return authFailureResponse(denied);
  const parsed = await parseSourceBody(request);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const created = await createSource(parsed.value);
  return Response.json(toPublic(created), { status: 201 });
}
