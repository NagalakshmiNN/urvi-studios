import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { formatINR } from "@/lib/format";
import { FREE_SHIP_THRESHOLD } from "@/lib/order-pricing";
import { notFound } from "next/navigation";
import OrderStatusForm from "./OrderStatusForm";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.orderNumber, orderNumber), with: { items: true } });
  if (!order) notFound();

  return (
    <>
      <div className="admin-header">
        <h1>{order.orderNumber}</h1>
        <OrderStatusForm orderId={order.id} currentStatus={order.status} />
      </div>

      <div className="admin-card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 10 }}>Items</h3>
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Size</th><th>Color</th><th>Qty</th><th>Price</th></tr></thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.productName}</td>
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
          <div>Shipping: {order.subtotal >= FREE_SHIP_THRESHOLD ? "Free" : "To confirm with customer (pincode-based)"}</div>
          {order.discount > 0 && <div>Discount ({order.couponCode}): −{formatINR(order.discount)}</div>}
          <div style={{ fontWeight: 700, marginTop: 6 }}>Total: {formatINR(order.total)}</div>
        </div>
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 10 }}>Customer & Shipping</h3>
        <p style={{ fontSize: 14, lineHeight: 1.8 }}>
          {order.customerName} · {order.customerEmail} · {order.customerPhone}<br />
          {order.addressLine1}, {order.city}, {order.state} {order.pincode}
          {order.notes && <><br /><em>Notes: {order.notes}</em></>}
        </p>
        <p style={{ fontSize: 12.5, color: "var(--sage)", marginTop: 10 }}>
          Payment: {order.paymentMethod === "razorpay" ? "Razorpay" : "WhatsApp / COD handoff"} · {order.paymentStatus}
          {order.razorpayPaymentId && <> · {order.razorpayPaymentId}</>}
        </p>
      </div>
    </>
  );
}
