// GST on apparel is a per-piece rate, not per order: 5% on any single item
// priced ₹2,500 or under, 18% above that — the two-slab structure the GST
// Council put in place from 22 September 2025 (it replaced the previous
// 5% / 12% slabs). Prices shown on the site are GST-inclusive, same
// treatment already used in the costing workbook, so this backs the tax out
// of the price rather than adding it on top — the total a customer sees
// doesn't change, this only shows how much of it is GST.
//
// This is a display estimate based on the published rate structure, not a
// substitute for a CA's sign-off on actual invoicing — flag that if it's
// ever wired into a real tax invoice.
const GST_THRESHOLD = 2500;
const GST_RATE_LOW = 0.05;
const GST_RATE_HIGH = 0.18;

export function gstRateForUnitPrice(unitPrice: number): number {
  return unitPrice <= GST_THRESHOLD ? GST_RATE_LOW : GST_RATE_HIGH;
}

export type GstLine = { price: number; qty: number };

export function calculateGst(lines: GstLine[]): { totalGst: number; rateLabel: string } {
  if (lines.length === 0) return { totalGst: 0, rateLabel: "—" };

  let totalGst = 0;
  const ratesUsed = new Set<number>();
  for (const l of lines) {
    const rate = gstRateForUnitPrice(l.price);
    ratesUsed.add(rate);
    const gstPerUnit = l.price - l.price / (1 + rate);
    totalGst += gstPerUnit * l.qty;
  }

  const rateLabel = [...ratesUsed]
    .sort((a, b) => a - b)
    .map((r) => `${Math.round(r * 100)}%`)
    .join("/");

  return { totalGst: Math.round(totalGst), rateLabel };
}
