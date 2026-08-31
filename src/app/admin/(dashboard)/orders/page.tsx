import { db } from "@/db";
import { formatINR } from "@/lib/format";
import Link from "next/link";

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;

  let orders = await db.query.orders.findMany({ orderBy: (o, { desc }) => [desc(o.createdAt)] });
  if (status !== "all") orders = orders.filter((o) => o.status === status);

  const STATUSES = ["all", "PLACED", "CONFIRMED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"];
  const SOURCE_LABELS: Record<string, string> = {
    online: "Website",
    whatsapp: "WhatsApp",
    phone: "Phone call",
    word_of_mouth: "Word of mouth",
    other: "Other",
  };

  return (
    <>
      <div className="admin-header">
        <h1>Orders</h1>
        <Link href="/admin/orders/new" className="btn btn-primary">Record an Order</Link>
      </div>

      <div className="filter-bar" style={{ marginBottom: 20 }}>
        {STATUSES.map((s) => (
          <Link key={s} href={s === "all" ? "/admin/orders" : `/admin/orders?status=${s}`} className={`chip ${status === s ? "active" : ""}`}>
            {s === "all" ? "All" : s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr><th>Order</th><th>Customer</th><th>Source</th><th>Status</th><th>Payment</th><th>Total</th><th>Date</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.orderNumber}`} style={{ color: "var(--olive)", fontWeight: 600 }}>{o.orderNumber}</Link></td>
                <td>{o.customerName}<br /><span style={{ color: "var(--sage)", fontSize: 11.5 }}>{o.customerPhone}</span></td>
                <td>{SOURCE_LABELS[o.source] ?? o.source}</td>
                <td><span className={`order-status-badge ${o.status.toLowerCase()}`}>{o.status.replace(/_/g, " ")}</span></td>
                <td>{o.paymentStatus}</td>
                <td>{formatINR(o.total)}</td>
                <td>{o.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p style={{ padding: 20, color: "var(--sage)" }}>No orders match this filter.</p>}
      </div>
    </>
  );
}
