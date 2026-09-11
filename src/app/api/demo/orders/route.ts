export const runtime = "nodejs";

// A stand-in for "the company's order API", written the way paginated APIs usually are: a page of
// records plus a `next` link that goes null on the last page. Exists so the pagination path is
// exercised by the seeded demo sources, not only by whatever real API someone happens to connect.
const PAGE_SIZE = 25;
const TOTAL = 120;
const CHANNELS = ["หน้าร้าน", "เดลิเวอรี่", "ออนไลน์"];
const STATUSES = ["ชำระแล้ว", "รอชำระ", "ยกเลิก"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const start = (page - 1) * PAGE_SIZE;
  const tick = Math.floor(Date.now() / 5_000);

  const items = Array.from({ length: Math.max(0, Math.min(PAGE_SIZE, TOTAL - start)) }, (_, i) => {
    const n = start + i;
    const qty = 1 + ((tick + n * 3) % 9);
    const unit = 45 + ((n * 17) % 120);
    return {
      order_id: `SO-${String(1000 + n)}`,
      channel: CHANNELS[n % CHANNELS.length],
      status: STATUSES[n % STATUSES.length],
      qty,
      unit_price: unit,
      total: qty * unit,
      ordered_at: new Date(Date.now() - n * 3_600_000).toISOString(),
    };
  });

  const hasNext = start + items.length < TOTAL;
  return Response.json({
    ok: true,
    page,
    page_size: PAGE_SIZE,
    total: TOTAL,
    items,
    next: hasNext ? `/api/demo/orders?page=${page + 1}` : null,
  });
}
