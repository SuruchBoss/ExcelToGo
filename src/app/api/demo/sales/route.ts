export const runtime = "nodejs";

// A stand-in for "the company's sales API": the same products every time, with quantities that
// drift on every request so a bound cell visibly changes on each refresh. Deliberately wrapped
// the way real APIs are ({ ok, data: { items } }) to exercise the auto-unwrapping.
const PRODUCTS = [
  { sku: "CF-01", name: "กาแฟลาเต้", category: "เครื่องดื่ม", price: 65 },
  { sku: "CF-02", name: "อเมริกาโน่", category: "เครื่องดื่ม", price: 55 },
  { sku: "BK-01", name: "ครัวซองต์", category: "เบเกอรี่", price: 45 },
  { sku: "BK-02", name: "บราวนี่", category: "เบเกอรี่", price: 50 },
  { sku: "TE-01", name: "ชาไทย", category: "เครื่องดื่ม", price: 45 },
];

export async function GET() {
  const tick = Math.floor(Date.now() / 5_000);
  const items = PRODUCTS.map((p, i) => {
    const base = 20 + ((tick * 7 + i * 13) % 30);
    const qty = base + Math.floor(Math.random() * 6);
    return { ...p, qty, total: qty * p.price, updated_at: new Date().toISOString() };
  });
  return Response.json({ ok: true, data: { items, count: items.length } });
}
