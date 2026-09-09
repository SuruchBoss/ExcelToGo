import { executeSource } from "@/lib/server/executeSource";
import { getSource } from "@/lib/server/sourceRepo";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: RouteContext<"/api/sources/[id]/data">) {
  const { id } = await ctx.params;
  const source = await getSource(id);
  if (!source) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    const table = await executeSource(source, new URL(request.url).origin);
    return Response.json(table);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "fetch_failed" }, { status: 502 });
  }
}
