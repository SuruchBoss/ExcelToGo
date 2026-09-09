import { createSource, listSources, toPublic } from "@/lib/server/sourceRepo";
import { parseSourceBody } from "./validate";

export const runtime = "nodejs";

export async function GET() {
  const sources = await listSources();
  return Response.json(sources.map(toPublic));
}

export async function POST(request: Request) {
  const parsed = await parseSourceBody(request);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const created = await createSource(parsed.value);
  return Response.json(toPublic(created), { status: 201 });
}
