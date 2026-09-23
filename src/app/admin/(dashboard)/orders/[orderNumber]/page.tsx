import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { formatINR } from "@/lib/format";
import { FREE_SHIP_THRESHOLD } from "@/lib/order-pricing";
import { notFound } from "next/navigation";
import OrderStatusForm from "./OrderStatusForm";
import ActualSalePriceForm from "./ActualSalePriceForm";
import ReconcileButton from "./ReconcileButton";
import { formatPaise } from "@/lib/sale-price";
import { whatsappLink } from "@/lib/whatsapp";
import { statusCustomerLine } from "@/lib/order-status-copy";
import { SOURCE_LABELS, FULFILMENT_LABELS, PAYMENT_MODE_LABELS } from "@/lib/order-channels";
import { SITE } from "@/lib/site-config";
import { ProductLabel, firstImageUrl } from "@/components/admin/ProductThumb";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  // Each line carries its product's photos, so the Items table can show what
  // was actually sold. A line whose product was later deleted has no product
  // at all — hence the optional chaining below, not a non-null assertion.
  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.orderNumber, orderNumber),
    with: { items: { with: { product: { with: { images: true } } } } },
  });
  if (!order) notFound();

  // A true automatic WhatsApp push to the customer needs a WhatsApp
  // Business API account (not set up — see the project checklist). This is
  // the honest substitute in the meantime: one tap opens a chat with the
  // customer's own number, pre-filled with an update matching their current
  // status, so sending it is a single extra tap rather than typing one out
  // by hand.
  const customerStatusLine = statusCustomerLine(order.status, order.fulfilmentMethod);
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
          <OrderStatusForm orderId={order.id} currentStatus={order.status} fulfilmentMethod={order.fulfilmentMethod} />
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 10 }}>Items</h3>
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Product ID</th><th>Size</th><th>Color</th><th>Qty</th><th>Price</th></tr></thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <ProductLabel
                    url={firstImageUrl(item.product?.images)}
                    name={item.productName}
                    href={item.productId ? `/admin/products/${item.productId}/edit` : undefined}
                  />
                </td>
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
          {order.actualSalePricePaise != null && (
            <div style={{ marginTop: 4, color: "var(--gold)" }}>
              Actual sale price: {formatPaise(order.actualSalePricePaise)}
            </div>
          )}
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 20 }}>
        <ActualSalePriceForm
          orderId={order.id}
          orderTotal={order.total}
          currentPaise={order.actualSalePricePaise}
        />
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
          {order.paymentMode && <> · {PAYMENT_MODE_LABELS[order.paymentMode] ?? order.paymentMode}</>}
          {order.razorpayPaymentId && <> · {order.razorpayPaymentId}</>}
          {/* Shown because its absence is a diagnosis. An order marked
              "Razorpay" with no order id here never reached Razorpay at all,
              and that is a different problem from one that reached it and
              went unpaid. */}
          <br />
          {order.razorpayOrderId
            ? <>Razorpay order: <code>{order.razorpayOrderId}</code></>
            : order.paymentMethod === "razorpay"
            ? <em>No Razorpay order id — this order never reached Razorpay.</em>
            : null}
        </p>

        {/* Shown for any unpaid Razorpay order, including one with no Razorpay
            order id. Gating that case out was a mistake: "this order never
            reached Razorpay" is the single most useful answer the check can
            give, and hiding the button made it the one answer you could never
            see. */}
        {order.paymentMethod === "razorpay" && order.paymentStatus !== "PAID" && order.paymentStatus !== "REFUNDED" && (
          <ReconcileButton orderId={order.id} />
        )}

        {/* A refund made in the Razorpay dashboard leaves no trace on this
            screen unless it is put here. Without it, an order that has been
            refunded reads exactly like one that was paid and kept. */}
        {order.refundedPaise > 0 && (
          <p className="notice-box" style={{ marginTop: 10, fontSize: 13 }}>
            <strong>Refunded {formatINR(Math.round(order.refundedPaise / 100))}</strong>
            {order.refundedAt && <> on {order.refundedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>}
            {order.refundedPaise >= order.total * 100
              ? " — the full amount. This order is cancelled and its stock has gone back on the shelf."
              : ` of ${formatINR(order.total)}. The order still stands and its stock is still deducted; mark it Returned if the garment is coming back.`}
          </p>
        )}
        <p style={{ fontSize: 12.5, color: "var(--sage)", marginTop: 4 }}>
          Channel: {SOURCE_LABELS[order.source] ?? order.source} ·{" "}
          {FULFILMENT_LABELS[order.fulfilmentMethod] ?? order.fulfilmentMethod}
        </p>
      </div>
    </>
  );
}
