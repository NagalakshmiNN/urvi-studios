import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { formatINR } from "@/lib/format";
import { FREE_SHIP_THRESHOLD } from "@/lib/order-pricing";
import { notFound } from "next/navigation";
import OrderStatusForm from "./OrderStatusForm";
import { whatsappLink } from "@/lib/whatsapp";
import { STATUS_CUSTOMER_LINES } from "@/lib/order-status-copy";
import { SITE } from "@/lib/site-config";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.orderNumber, orderNumber), with: { items: true } });
  if (!order) notFound();

  // A true automatic WhatsApp push to the customer needs a WhatsApp
  // Business API account (not set up — see the project checklist). This is
  // the honest substitute in the meantime: one tap opens a chat with the
  // customer's own number, pre-filled with an update matching their current
  // status, so sending it is a single extra tap rather than typing one out
  // by hand.
  const customerStatusLine = STATUS_CUSTOMER_LINES[order.status];
  const customerWhatsappHref = customerStatusLine
    ? whatsappLink(
        order.customerPhone,
        `Hi ${order.customerName}, an update on your Urvi Studios order ${order.orderNumber}: ${customerStatusLine} Track it any time: ${SITE.siteUrl}/account/orders/${order.orderNumber}`
      )
    : null;

  return (
    <>
      <div className="admin-header">
        <h1>{order.orderNumber}</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {customerWhatsappHref && (
            <a href={customerWhatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 12.5 }}>
              Message Customer on WhatsApp
            </a>
          )}
          <OrderStatusForm orderId={order.id} currentStatus={order.status} />
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 10 }}>Items</h3>
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Product ID</th><th>Size</th><th>Color</th><th>Qty</th><th>Price</th></tr></thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.productName}</td>
                <td><code style={{ fontSize: 12 }}>{item.sku || "—"}</code></td>
                <td>{item.size}</td>
                <td>{item.color}</td>
                <td>{item.qty}</td>
                <td>{formatINR(item.price * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 16, textAlign: "right", fontSize: 14 }}>
          <div>Subtotal: {formatINR(order.subtotal)}</div>
          <div>Delivery: {order.subtotal >= FREE_SHIP_THRESHOLD ? "Free" : "Additional — confirm with customer (pincode-based)"}</div>
          {order.discount > 0 && <div>Discount ({order.couponCode}): −{formatINR(order.discount)}</div>}
          <div style={{ fontWeight: 700, marginTop: 6 }}>Total: {formatINR(order.total)}</div>
        </div>
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 10 }}>Customer & Shipping</h3>
        <p style={{ fontSize: 14, lineHeight: 1.8 }}>
          {[order.customerName, order.customerEmail, order.customerPhone].filter(Boolean).join(" · ")}<br />
          {[order.addressLine1, order.city, order.state, order.pincode].filter(Boolean).join(", ") || (
            <span style={{ color: "var(--sage)" }}>No address on file yet</span>
          )}
          {order.notes && <><br /><em>Notes: {order.notes}</em></>}
        </p>
        <p style={{ fontSize: 12.5, color: "var(--sage)", marginTop: 10 }}>
          Payment: {order.paymentMethod === "razorpay" ? "Razorpay" : order.paymentMethod === "manual" ? "Recorded manually" : "WhatsApp / COD handoff"} · {order.paymentStatus}
          {order.razorpayPaymentId && <> · {order.razorpayPaymentId}</>}
        </p>
        <p style={{ fontSize: 12.5, color: "var(--sage)", marginTop: 4 }}>
          Source: {{ online: "Website", whatsapp: "WhatsApp", phone: "Phone call", word_of_mouth: "Word of mouth", other: "Other" }[order.source] ?? order.source}
        </p>
      </div>
    </>
  );
}
