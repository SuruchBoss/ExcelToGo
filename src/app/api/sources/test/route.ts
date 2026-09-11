import { executeSource } from "@/lib/server/executeSource";
import { getSource } from "@/lib/server/sourceRepo";
import { parseSourceBody } from "../validate";
import { fetchErrorResponse } from "../errorResponse";

export const runtime = "nodejs";

/** "Test connection" from the setup form: runs a config without saving it. If the form is
 *  editing an existing source and left the masked secret in place, reuse the stored one. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const editingId = url.searchParams.get("id");
  const parsed = await parseSourceBody(request);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  const cfg = parsed.value;
  if (cfg.authHeader?.value === "••••••••" && editingId) {
    const existing = await getSource(editingId);
    cfg.authHeader = existing?.authHeader;
  }
  try {
    const table = await executeSource(cfg, url.origin);
    return Response.json(table);
  } catch (err) {
    return fetchErrorResponse(err);
  }
}
