import { db, schema } from "@/db";
import { asc, desc, eq, sql } from "drizzle-orm";
import VendorForm from "./VendorForm";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const vendors = await db.select().from(schema.vendors).orderBy(asc(schema.vendors.code));

  // What each vendor has actually supplied, so the list is useful rather than
  // just a contact book.
  const totals = await db
    .select({
      vendorId: schema.purchases.vendorId,
      purchases: sql<number>`count(*)::int`,
      pieces: sql<number>`coalesce(sum(${schema.purchases.totalQty}), 0)::int`,
      landedPaise: sql<number>`coalesce(sum(${schema.purchases.landedTotalPaise}), 0)::bigint`,
    })
    .from(schema.purchases)
    .groupBy(schema.purchases.vendorId);

  const byVendor = new Map(totals.map((t) => [t.vendorId, t]));

  return (
    <>
      <div className="admin-header">
        <h1>Vendors</h1>
      </div>

      <div className="admin-card" style={{ marginBottom: 28 }}>
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Where</th>
                <th>GSTIN</th>
                <th style={{ textAlign: "right" }}>Purchases</th>
                <th style={{ textAlign: "right" }}>Pieces</th>
                <th style={{ textAlign: "right" }}>Spent</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => {
                const t = byVendor.get(v.id);
                return (
                  <tr key={v.id}>
                    <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{v.code}</td>
                    <td>{v.name}{v.type && <div style={{ fontSize: 12, color: "var(--sage)" }}>{v.type}</div>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{[v.city, v.state].filter(Boolean).join(", ") || "—"}</td>
                    <td style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{v.gstin || "—"}</td>
                    <td style={{ textAlign: "right" }}>{t?.purchases ?? 0}</td>
                    <td style={{ textAlign: "right" }}>{t?.pieces ?? 0}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      ₹{Math.round(Number(t?.landedPaise ?? 0) / 100).toLocaleString("en-IN")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--sage)", marginTop: 14, lineHeight: 1.7 }}>
          A vendor is created on its own the first time an invoice from them is entered, so this form is only needed for
          one you want on file in advance.
        </p>
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 16 }}>Add a vendor</h3>
        <VendorForm />
      </div>
    </>
  );
}
