export const runtime = "nodejs";

// A single-object payload (no array) — the "today's KPIs" shape, so the panel can show that a
// scalar response becomes draggable single-value fields rather than a table.
export async function GET() {
  const t = Date.now();
  const orders = 120 + Math.floor((t / 10_000) % 40) + Math.floor(Math.random() * 3);
  const total = orders * 187 + Math.floor(Math.random() * 500);
  return Response.json({
    today_total: total,
    orders,
    avg_ticket: Math.round((total / orders) * 100) / 100,
    top_product: "กาแฟลาเต้",
    updated_at: new Date().toISOString(),
  });
}
