import Link from "next/link";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

function rupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

function readableDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function PurchasesPage() {
  const rows = await db.query.purchases.findMany({
    with: { vendor: true },
    orderBy: [desc(schema.purchases.invoiceDate), desc(schema.purchases.createdAt)],
    limit: 100,
  });

  const pieces = rows.reduce((a, r) => a + r.totalQty, 0);
  const landed = rows.reduce((a, r) => a + r.landedTotalPaise, 0);

  return (
    <>
      <div className="admin-header">
        <h1>Purchases</h1>
        <Link href="/admin/purchases/new" className="btn btn-primary">Enter a purchase</Link>
      </div>

      {rows.length === 0 ? (
        <div className="admin-card">
          <h3 style={{ marginBottom: 8 }}>Nothing recorded here yet</h3>
          <p style={{ fontSize: 13.5, color: "var(--sage)", lineHeight: 1.7 }}>
            Purchases entered here are what the costing workbook&apos;s Procurement Register used to hold. Everything a
            purchase touches — products, sizes, stock, landed cost, price and the money paid — follows from the one
            entry, so an invoice never needs typing twice.
          </p>
        </div>
      ) : (
        <>
          <div className="admin-card" style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 14, margin: 0 }}>
              <strong>{rows.length}</strong> purchase{rows.length === 1 ? "" : "s"} ·{" "}
              <strong>{pieces.toLocaleString("en-IN")}</strong> pieces ·{" "}
              <strong>{rupees(landed)}</strong> landed
            </p>
          </div>

          <div className="admin-card">
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Invoice</th>
                    <th>Vendor</th>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}>Pieces</th>
                    <th style={{ textAlign: "right" }}>Landed</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{r.ref}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{r.invoiceNumber}</td>
                      <td>{r.vendor.name}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{readableDate(r.invoiceDate)}</td>
                      <td style={{ textAlign: "right" }}>{r.totalQty}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{rupees(r.landedTotalPaise)}</td>
                      <td><Link href={`/admin/purchases/${r.id}`} className="link-btn">View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
