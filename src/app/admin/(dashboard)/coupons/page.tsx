import { db } from "@/db";
import { formatINR } from "@/lib/format";
import NewCouponForm from "./NewCouponForm";
import CouponToggle from "./CouponToggle";

export default async function AdminCouponsPage() {
  const coupons = await db.query.coupons.findMany({ orderBy: (c, { desc }) => [desc(c.createdAt)] });

  return (
    <>
      <div className="admin-header">
        <h1>Coupons</h1>
      </div>

      <div className="admin-card" style={{ marginBottom: 24 }}>
        <table className="admin-table">
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min. order</th><th>Active</th></tr></thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.code}</td>
                <td>{c.type === "PERCENT" ? "Percent off" : "Flat off"}</td>
                <td>{c.type === "PERCENT" ? `${c.value}%` : formatINR(c.value)}</td>
                <td>{c.minOrderValue ? formatINR(c.minOrderValue) : "—"}</td>
                <td><CouponToggle couponId={c.id} active={c.active} /></td>
              </tr>
            ))}
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
