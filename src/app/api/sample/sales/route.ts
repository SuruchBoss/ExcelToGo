// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { Locale } from "@/i18n/types";
import { demoLanguage } from "@/lib/server/demoSources";

export const runtime = "nodejs";

// A stand-in for "the company's sales API": the same products every time, with quantities that
// drift on every request so a bound cell visibly changes on each refresh. Deliberately wrapped
// the way real APIs are ({ ok, data: { items } }) to exercise the auto-unwrapping.
const PRODUCTS = [
  { sku: "CF-01", price: 65 },
  { sku: "CF-02", price: 55 },
  { sku: "BK-01", price: 45 },
  { sku: "BK-02", price: 50 },
  { sku: "TE-01", price: 45 },
];
// Names and categories per language, in PRODUCTS' order. The sku, price and the drift below are
// shared, so the two languages are the same five products rather than two similar-looking sets.
const WORDS: Record<Locale, [string, string][]> = {
  th: [
    ["กาแฟลาเต้", "เครื่องดื่ม"],
    ["อเมริกาโน่", "เครื่องดื่ม"],
    ["ครัวซองต์", "เบเกอรี่"],
    ["บราวนี่", "เบเกอรี่"],
    ["ชาไทย", "เครื่องดื่ม"],
  ],
  en: [
    ["Caffè latte", "Drinks"],
    ["Americano", "Drinks"],
    ["Croissant", "Bakery"],
    ["Brownie", "Bakery"],
    ["Thai iced tea", "Drinks"],
  ],
};

export async function GET(request: Request) {
  const words = WORDS[demoLanguage(new URL(request.url).searchParams.get("lang"))];
  const tick = Math.floor(Date.now() / 5_000);
  const items = PRODUCTS.map((p, i) => {
    const base = 20 + ((tick * 7 + i * 13) % 30);
    const qty = base + Math.floor(Math.random() * 6);
    const [name, category] = words[i];
    return { sku: p.sku, name, category, price: p.price, qty, total: qty * p.price, updated_at: new Date().toISOString() };
  });
  return Response.json({ ok: true, data: { items, count: items.length } });
}
