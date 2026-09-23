import { db } from "@/db";
import { formatINR } from "@/lib/format";
import { couponUsageTotals, remainingUses } from "@/lib/coupon-usage";
import NewCouponForm from "./NewCouponForm";
import CouponToggle from "./CouponToggle";

export default async function AdminCouponsPage() {
  const coupons = await db.query.coupons.findMany({ orderBy: (c, { desc }) => [desc(c.createdAt)] });
  // One query for every coupon's count, not one per row.
  const used = await couponUsageTotals();

  return (
    <>
      <div className="admin-header">
        <h1>Coupons</h1>
      </div>

      <div className="admin-card" style={{ marginBottom: 24 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Value</th>
              <th>Min. order</th>
              <th>Used</th>
              <th>Per customer</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => {
              const count = used.get(c.code) ?? 0;
              const left = remainingUses({ usageLimit: c.usageLimit, perCustomerLimit: c.perCustomerLimit }, count);
              const exhausted = left === 0;
              return (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.code}</td>
                  <td>{c.type === "PERCENT" ? "Percent off" : "Flat off"}</td>
                  <td>{c.type === "PERCENT" ? `${c.value}%` : formatINR(c.value)}</td>
                  <td>{c.minOrderValue ? formatINR(c.minOrderValue) : "—"}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                    {c.usageLimit === null ? (
                      // Spelt out rather than shown as a dash: "no limit" is a
                      // decision with a cost, and it should read like one.
                      <>
                        {count} <span style={{ color: "var(--sage)" }}>of unlimited</span>
                      </>
                    ) : (
                      <span style={{ color: exhausted ? "#a8422f" : undefined, fontWeight: exhausted ? 600 : undefined }}>
                        {count} of {c.usageLimit}
                        {exhausted ? " — used up" : ""}
                      </span>
                    )}
                  </td>
                  <td>{c.perCustomerLimit === null ? <span style={{ color: "var(--sage)" }}>No limit</span> : c.perCustomerLimit}</td>
                  <td><CouponToggle couponId={c.id} active={c.active} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {coupons.length === 0 && <p style={{ padding: 20, color: "var(--sage)" }}>No coupons yet.</p>}
      </div>

      <div className="admin-card admin-form-card">
        <h3 style={{ marginBottom: 14 }}>New Coupon</h3>
        <NewCouponForm />
      </div>
    </>
  );
}
