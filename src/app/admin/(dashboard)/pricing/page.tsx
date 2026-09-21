import { db, schema } from "@/db";
import { loadBands } from "@/lib/markup-band-store";
import { bandUsage } from "@/lib/markup-bands";
import PricingControls, { type BandRow } from "./PricingControls";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const bands = await loadBands();
  const products = await db
    .select({ price: schema.products.price, landedCost: schema.products.landedCost })
    .from(schema.products);

  const usage = bandUsage(bands, products);
  const rows: BandRow[] = usage.map((u) => ({
    ...u.band,
    label: u.label,
    products: u.products,
    medianMarkupPct: u.medianMarkupPct,
    wouldChange: u.wouldChange,
  }));

  const uncosted = products.filter((p) => p.landedCost == null || p.landedCost <= 0).length;

  return (
    <>
      <div className="admin-header">
        <h1>Pricing</h1>
      </div>

      <div className="notice-box" style={{ marginBottom: 28 }}>
        <strong>What to charge, worked out from what it cost.</strong> A price is its landed cost plus a markup, rounded
        up to the nearest ₹10 — the same rule the costing workbook has always used. What is new is that the markup comes
        from a band rather than being typed onto every product, because a ₹200 kurti and a ₹2,000 suit set were never
        really priced by the same rule.
      </div>

      {uncosted > 0 && (
        <div className="notice-box" style={{ marginBottom: 28 }}>
          <strong>{uncosted} product{uncosted === 1 ? " has" : "s have"} no landed cost recorded.</strong> They cannot be
          priced from a band, and they count as worth nothing on the Money Map — so the rail is worth more than it says.
          They will fill in on their own as stock is bought through <em>Purchases</em>; the older ones need their
          original invoices.
        </div>
      )}

      <PricingControls rows={rows} />
    </>
  );
}
