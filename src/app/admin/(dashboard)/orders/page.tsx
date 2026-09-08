import { db } from "@/db";
import { formatINR } from "@/lib/format";
import { SOURCE_LABELS, PAYMENT_MODE_LABELS } from "@/lib/order-channels";
import { statusLabel } from "@/lib/order-status-copy";
import Link from "next/link";

const STATUSES = ["all", "PLACED", "CONFIRMED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"];

// The two things worth separating at a glance: what came through the website
// on its own, and what was sold face to face.
const CHANNELS = [
  { value: "all", label: "All channels" },
  { value: "online", label: "Website" },
  { value: "walk_in", label: "Walk-in" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Phone" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; channel?: string; phone?: string }>;
}) {
  const { status = "all", channel = "all", phone } = await searchParams;

  let orders = await db.query.orders.findMany({ orderBy: (o, { desc }) => [desc(o.createdAt)] });
  if (status !== "all") orders = orders.filter((o) => o.status === status);
  if (channel !== "all") orders = orders.filter((o) => o.source === channel);
  // Arrived here from the Customers screen — one person's whole history.
  if (phone) orders = orders.filter((o) => o.customerPhone.replace(/\D/g, "") === phone.replace(/\D/g, ""));

  const total = orders.reduce((sum, o) => sum + o.total, 0);

  function href(next: { status?: string; channel?: string }) {
    const p = new URLSearchParams();
    const s = next.status ?? status;
    const c = next.channel ?? channel;
    if (s !== "all") p.set("status", s);
    if (c !== "all") p.set("channel", c);
    if (phone) p.set("phone", phone);
    const qs = p.toString();
    return `/admin/orders${qs ? "?" + qs : ""}`;
  }

  return (
    <>
      <div className="admin-header">
        <h1>Orders</h1>
        <Link href="/admin/orders/new" className="btn btn-primary">Record a Sale</Link>
      </div>

      {phone && (
        <div className="notice-box" style={{ marginBottom: 16 }}>
          Showing every order for <strong>{phone}</strong> — {orders.length} order{orders.length === 1 ? "" : "s"},{" "}
          {formatINR(total)} in total. <Link href="/admin/orders">Show all orders</Link>
        </div>
      )}

      <div className="filter-bar" style={{ marginBottom: 12 }}>
        {CHANNELS.map((c) => (
          <Link key={c.value} href={href({ channel: c.value })} className={`chip ${channel === c.value ? "active" : ""}`}>
            {c.label}
          </Link>
        ))}
      </div>

      <div className="filter-bar" style={{ marginBottom: 20 }}>
        {STATUSES.map((s) => (
          <Link key={s} href={href({ status: s })} className={`chip ${status === s ? "active" : ""}`}>
            {s === "all" ? "All statuses" : s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Channel</th>
              <th>How it reaches them</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Total</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.orderNumber}`} style={{ color: "var(--olive)", fontWeight: 600 }}>{o.orderNumber}</Link></td>
                <td>
                  {o.customerName}
                  <br />
                  <Link href={`/admin/orders?phone=${encodeURIComponent(o.customerPhone)}`} style={{ color: "var(--sage)", fontSize: 11.5 }}>
                    {o.customerPhone}
                  </Link>
                </td>
                <td>{SOURCE_LABELS[o.source] ?? o.source}</td>
                <td style={{ fontSize: 12.5 }}>
                  {o.fulfilmentMethod === "pickup" ? "Collected in person" : "Delivery"}
                </td>
                <td><span className={`order-status-badge ${o.status.toLowerCase()}`}>{statusLabel(o.status, o.fulfilmentMethod)}</span></td>
                <td style={{ fontSize: 12.5 }}>
                  {o.paymentStatus}
                  {o.paymentMode && <><br /><span style={{ color: "var(--sage)", fontSize: 11.5 }}>{PAYMENT_MODE_LABELS[o.paymentMode]}</span></>}
                </td>
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
