import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AccountNav from "@/components/AccountNav";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { getCustomerSession } from "@/lib/auth";
import { formatINR } from "@/lib/format";
import Link from "next/link";

export default async function OrdersPage() {
  const customerId = (await getCustomerSession())!;
  const orders = await db.query.orders.findMany({
    where: eq(schema.orders.customerId, customerId),
    orderBy: desc(schema.orders.createdAt),
  });

  return (
    <>
      <SiteHeader active="Account" />
      <div className="page-hero container">
        <div className="eyebrow">My Account</div>
        <h1>Your Orders</h1>
      </div>
      <div className="container account-layout">
        <AccountNav active="Orders" />
        <div>
          {orders.length === 0 ? (
            <div className="empty-state">
              <h3>No orders yet</h3>
              <p>When you place an order, it'll show up here.</p>
              <Link href="/shop" className="btn btn-outline" style={{ marginTop: 16 }}>Start Shopping</Link>
            </div>
          ) : (
            <div className="order-list">
              {orders.map((o) => (
                <Link href={`/account/orders/${o.orderNumber}`} className="order-card" key={o.id}>
                  <div>
                    <div className="order-card-num">{o.orderNumber}</div>
                    <div className="order-card-date">{o.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                  <span className={`order-status-badge ${o.status.toLowerCase()}`}>{o.status.replace(/_/g, " ")}</span>
                  <div className="order-card-total">{formatINR(o.total)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
