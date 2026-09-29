import { db, schema } from "@/db";
import { loadBands } from "@/lib/markup-band-store";
import { bandUsage, bandFor, bandLabel } from "@/lib/markup-bands";
import PricingControls, { type BandRow } from "./PricingControls";
import ProductMarkupTable from "./ProductMarkupTable";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const bands = await loadBands();
  const products = await db
    .select({
      id: schema.products.id,
      sku: schema.products.sku,
      name: schema.products.name,
      price: schema.products.price,
      landedCost: schema.products.landedCost,
      minRoundUpTo: schema.products.minRoundUpTo,
      maxRoundUpTo: schema.products.maxRoundUpTo,
      targetMarkupPct: schema.products.targetMarkupPct,
      minMarkupPct: schema.products.minMarkupPct,
    })
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

  // Build per-product rows with their band info
  const productRows = products.map((p) => {
    const band = p.landedCost != null && p.landedCost > 0
      ? bandFor(p.landedCost * 100, bands)
      : bands[bands.length - 1]; // fallback for display
    const idx = bands.indexOf(band);
    return {
      ...p,
      bandTargetPct: band.targetPct,
      bandMinPct: band.minPct,
      bandLabel: bandLabel(band, idx, bands),
    };
  });

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

      <PricingControls rows={rows} overrideCount={products.filter((p) => p.targetMarkupPct != null || p.minMarkupPct != null).length} />

      <ProductMarkupTable products={productRows} />
    </>
  );
}
