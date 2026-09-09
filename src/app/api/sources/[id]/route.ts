import { deleteSource, toPublic, updateSource } from "@/lib/server/sourceRepo";
import { parseSourceBody } from "../validate";

export const runtime = "nodejs";

export async function PUT(request: Request, ctx: RouteContext<"/api/sources/[id]">) {
  const { id } = await ctx.params;
  const parsed = await parseSourceBody(request);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const updated = await updateSource(id, parsed.value);
  if (!updated) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(toPublic(updated));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/sources/[id]">) {
  const { id } = await ctx.params;
  const ok = await deleteSource(id);
  if (!ok) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
