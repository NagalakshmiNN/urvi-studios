import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AccountNav from "@/components/AccountNav";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getCustomerSession } from "@/lib/auth";
import { formatINR } from "@/lib/format";
import { FREE_SHIP_THRESHOLD } from "@/lib/order-pricing";
import { notFound } from "next/navigation";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const customerId = (await getCustomerSession())!;

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.orderNumber, orderNumber),
    with: { items: true },
  });

  if (!order || order.customerId !== customerId) notFound();

  return (
    <>
      <SiteHeader active="Account" />
      <div className="page-hero container">
        <div className="eyebrow">Order {order.orderNumber}</div>
        <h1>Order Details</h1>
      </div>
      <div className="container account-layout">
        <AccountNav active="Orders" />
        <div>
          <div className="order-detail-header">
            <span className={`order-status-badge ${order.status.toLowerCase()}`}>{order.status.replace(/_/g, " ")}</span>
            <span style={{ color: "var(--sage)", fontSize: 13 }}>
              Placed {order.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>

          <div className="order-items-list">
            {order.items.map((item) => (
              <div className="order-item-row" key={item.id}>
                <div>
                  <div className="name">{item.productName}</div>
                  <div className="meta">Size {item.size} · {item.color} · Qty {item.qty}</div>
                  {item.sku && <div className="meta" style={{ fontFamily: "monospace", fontSize: 11.5 }}>Product ID — {item.sku}</div>}
                </div>
                <div className="price">{formatINR(item.price * item.qty)}</div>
              </div>
            ))}
          </div>

          <div className="summary-card" style={{ maxWidth: 360, marginTop: 24 }}>
            <div className="summary-row"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
            <div className="summary-row"><span>Delivery</span><span>{order.subtotal >= FREE_SHIP_THRESHOLD ? "Free" : "Additional"}</span></div>
            {order.discount > 0 && <div className="summary-row"><span>Discount {order.couponCode ? `(${order.couponCode})` : ""}</span><span>−{formatINR(order.discount)}</span></div>}
            <div className="summary-row total"><span>Total</span><span>{formatINR(order.total)}</span></div>
          </div>

          <h3 style={{ marginTop: 30, marginBottom: 10 }}>Shipping To</h3>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--earth)" }}>
            {order.customerName}<br />
            {order.addressLine1}<br />
            {order.city}, {order.state} {order.pincode}<br />
            {order.customerPhone}
          </p>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
