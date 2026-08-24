import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Link from "next/link";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { formatINR } from "@/lib/format";

export default async function OrderSuccessPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: orderNumber } = await searchParams;
  const order = orderNumber ? await db.query.orders.findFirst({ where: eq(schema.orders.orderNumber, orderNumber), with: { items: true } }) : null;

  return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "80px 0", textAlign: "center" }}>
        <div className="eyebrow">Thank you</div>
        <h1 style={{ marginBottom: 10 }}>Your order is confirmed</h1>
        {order ? (
          <>
            <p className="lede" style={{ margin: "0 auto 30px" }}>
              Order <strong>{order.orderNumber}</strong> — {formatINR(order.total)} — is on its way to being packed. A
              confirmation has been noted against {order.customerEmail}.
            </p>
            <div style={{ maxWidth: 420, margin: "0 auto", textAlign: "left" }} className="order-items-list">
              {order.items.map((item) => (
                <div className="order-item-row" key={item.id}>
                  <div>
                    <div className="name">{item.productName}</div>
                    <div className="meta">Size {item.size} · {item.color} · Qty {item.qty}</div>
                  </div>
                  <div className="price">{formatINR(item.price * item.qty)}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="lede" style={{ margin: "0 auto 30px" }}>We couldn&apos;t find that order, but if payment went through, we&apos;ve got it — reach out on WhatsApp and we&apos;ll confirm right away.</p>
        )}
        <Link href="/shop" className="btn btn-primary" style={{ marginTop: 10 }}>Continue Shopping</Link>
      </div>
      <SiteFooter />
    </>
  );
}
