import { createSource, listSources, toPublic } from "@/lib/server/sourceRepo";
import { parseSourceBody } from "./validate";
import { DEMO_MODE, demoModeResponse } from "@/lib/demoMode";

export const runtime = "nodejs";

export async function GET() {
  if (DEMO_MODE) return demoModeResponse();
  const sources = await listSources();
  return Response.json(sources.map(toPublic));
}

export async function POST(request: Request) {
  if (DEMO_MODE) return demoModeResponse();
  const parsed = await parseSourceBody(request);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const created = await createSource(parsed.value);
  return Response.json(toPublic(created), { status: 201 });
}
