import { executeSource } from "@/lib/server/executeSource";
import { getSource, withSecret } from "@/lib/server/sourceRepo";
import { authFailureResponse, checkSourcesAuth } from "@/lib/server/sourcesAuth";
import { fetchErrorResponse } from "../../errorResponse";
import { DEMO_MODE, demoModeResponse } from "@/lib/demoMode";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: RouteContext<"/api/sources/[id]/data">) {
  if (DEMO_MODE) return demoModeResponse();
  const denied = checkSourcesAuth(request);
  if (denied) return authFailureResponse(denied);
  const { id } = await ctx.params;
  const source = await getSource(id);
  if (!source) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    const table = await executeSource(withSecret(source), new URL(request.url).origin);
    return Response.json(table);
  } catch (err) {
    return fetchErrorResponse(err);
  }
}
