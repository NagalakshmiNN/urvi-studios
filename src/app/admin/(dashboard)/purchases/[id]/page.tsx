import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function rupees(paise: number, decimals = 2): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function readableDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const purchase = await db.query.purchases.findFirst({
    where: eq(schema.purchases.id, id),
    with: { vendor: true },
  });
  if (!purchase) notFound();

  const lines = await db.query.purchaseLines.findMany({
    where: eq(schema.purchaseLines.purchaseId, id),
    orderBy: [asc(schema.purchaseLines.position)],
    with: { product: true },
  });

  return (
    <>
      <div className="admin-header">
        <h1>{purchase.ref}</h1>
        <Link href="/admin/purchases" className="btn btn-outline">All purchases</Link>
      </div>

      <div className="admin-card" style={{ marginBottom: 28 }}>
        <h3 style={{ marginBottom: 12 }}>
          {purchase.vendor.name} <span style={{ color: "var(--sage)", fontWeight: 400, fontSize: 15 }}>· invoice {purchase.invoiceNumber}</span>
        </h3>
        <p style={{ fontSize: 13.5, color: "var(--sage)", margin: 0, lineHeight: 1.7 }}>
          {readableDate(purchase.invoiceDate)}
          {purchase.paymentMode && <> · paid by {purchase.paymentMode}</>}
          {purchase.vendor.gstin && <> · GSTIN {purchase.vendor.gstin}</>}
          {purchase.notes && <> · {purchase.notes}</>}
        </p>

        <div className="table-scroll" style={{ marginTop: 20 }}>
          <table className="admin-table">
            <tbody>
              <tr><td>Gross</td><td style={{ textAlign: "right" }}>{rupees(purchase.grossPaise)}</td></tr>
              {purchase.discountPaise > 0 && (
                <tr><td>Less discount</td><td style={{ textAlign: "right" }}>− {rupees(purchase.discountPaise)}</td></tr>
              )}
              <tr><td>Taxable</td><td style={{ textAlign: "right" }}>{rupees(purchase.taxablePaise)}</td></tr>
              <tr><td>GST</td><td style={{ textAlign: "right" }}>{rupees(purchase.gstPaise)}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Invoice total</td><td style={{ textAlign: "right", fontWeight: 600 }}>{rupees(purchase.taxablePaise + purchase.gstPaise)}</td></tr>
              {purchase.freightPaise > 0 && (
                <tr><td>Freight</td><td style={{ textAlign: "right" }}>{rupees(purchase.freightPaise)}</td></tr>
              )}
              {purchase.otherChargesPaise > 0 && (
                <tr><td>Other charges</td><td style={{ textAlign: "right" }}>{rupees(purchase.otherChargesPaise)}</td></tr>
              )}
              <tr>
                <td style={{ fontWeight: 600 }}>Landed cost of {purchase.totalQty} pieces</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{rupees(purchase.landedTotalPaise)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 6 }}>{lines.length} line{lines.length === 1 ? "" : "s"}</h3>
        <p style={{ fontSize: 12.5, color: "var(--sage)", margin: "0 0 18px", lineHeight: 1.7 }}>
          What each line cost to land: its own price, less its share of the discount, plus GST and its share of the
          freight. These figures are exactly what was worked out when the purchase was recorded — they are the record,
          not a recalculation, so a change to the rounding rules can never rewrite them.
        </p>
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Size</th>
                <th style={{ textAlign: "right" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Unit</th>
                <th style={{ textAlign: "right" }}>Discount</th>
                <th style={{ textAlign: "right" }}>GST</th>
                <th style={{ textAlign: "right" }}>Freight</th>
                <th style={{ textAlign: "right" }}>Landed</th>
                <th style={{ textAlign: "right" }}>Per piece</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.product ? (
                      <Link href={`/admin/products/${l.product.id}`}>{l.item}{l.colour ? ` — ${l.colour}` : ""}</Link>
                    ) : (
                      <>{l.item}{l.colour ? ` — ${l.colour}` : ""}</>
                    )}
                  </td>
                  <td>{l.size}</td>
                  <td style={{ textAlign: "right" }}>{l.qty}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{rupees(l.unitPricePaise)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", color: "var(--sage)" }}>
                    {l.discountSharePaise > 0 ? `− ${rupees(l.discountSharePaise)}` : "—"}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", color: "var(--sage)" }}>
                    {rupees(l.gstPaise)} <span style={{ fontSize: 11 }}>({l.gstRatePct}%)</span>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", color: "var(--sage)" }}>
                    {l.freightSharePaise > 0 ? rupees(l.freightSharePaise) : "—"}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", fontWeight: 600 }}>{rupees(l.landedPaise)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{rupees(l.landedPerUnitPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
