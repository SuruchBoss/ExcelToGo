// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { Locale } from "@/i18n/types";
import { demoLanguage } from "@/lib/server/demoSources";

export const runtime = "nodejs";

// A stand-in for "the company's order API", written the way paginated APIs usually are: a page of
// records plus a `next` link that goes null on the last page. Exists so the pagination path is
// exercised by the seeded demo sources, not only by whatever real API someone happens to connect.
const PAGE_SIZE = 25;
const TOTAL = 120;
const CHANNELS: Record<Locale, string[]> = { th: ["หน้าร้าน", "เดลิเวอรี่", "ออนไลน์"], en: ["In store", "Delivery", "Online"] };
const STATUSES: Record<Locale, string[]> = { th: ["ชำระแล้ว", "รอชำระ", "ยกเลิก"], en: ["Paid", "Awaiting payment", "Cancelled"] };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const lang = demoLanguage(url.searchParams.get("lang"));
  // The next page has to be asked for in the same language, or a table would switch halfway down.
  const langParam = lang === "th" ? "" : `&lang=${lang}`;
  const start = (page - 1) * PAGE_SIZE;
  const tick = Math.floor(Date.now() / 5_000);

  const items = Array.from({ length: Math.max(0, Math.min(PAGE_SIZE, TOTAL - start)) }, (_, i) => {
    const n = start + i;
    const qty = 1 + ((tick + n * 3) % 9);
    const unit = 45 + ((n * 17) % 120);
    return {
      order_id: `SO-${String(1000 + n)}`,
      channel: CHANNELS[lang][n % CHANNELS[lang].length],
      status: STATUSES[lang][n % STATUSES[lang].length],
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
    next: hasNext ? `/api/demo/orders?page=${page + 1}${langParam}` : null,
  });
}
