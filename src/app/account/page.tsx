import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AccountNav from "@/components/AccountNav";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { getCustomerSession } from "@/lib/auth";
import { formatINR } from "@/lib/format";
import Link from "next/link";

export default async function AccountOverviewPage() {
  const customerId = (await getCustomerSession())!;
  const customer = await db.query.customers.findFirst({ where: eq(schema.customers.id, customerId) });
  const recentOrders = await db.query.orders.findMany({
    where: eq(schema.orders.customerId, customerId),
    orderBy: desc(schema.orders.createdAt),
    limit: 3,
  });

  return (
    <>
      <SiteHeader active="Account" />
      <div className="page-hero container">
        <div className="eyebrow">My Account</div>
        <h1>Welcome, {customer?.name?.split(" ")[0] || "there"}</h1>
      </div>
      <div className="container account-layout">
        <AccountNav active="Overview" />
        <div>
          <div className="notice-box" style={{ marginBottom: 28 }}>
            {customer?.email} {customer?.phone ? `· ${customer.phone}` : ""}
          </div>
          <h3 style={{ marginBottom: 14 }}>Recent Orders</h3>
          {recentOrders.length === 0 ? (
            <div className="empty-state">
              <h3>No orders yet</h3>
              <p>When you place an order, it'll show up here.</p>
              <Link href="/shop" className="btn btn-outline" style={{ marginTop: 16 }}>Start Shopping</Link>
            </div>
          ) : (
            <div className="order-list">
              {recentOrders.map((o) => (
                <Link href={`/account/orders/${o.orderNumber}`} className="order-card" key={o.id}>
                  <div>
                    <div className="order-card-num">{o.orderNumber}</div>
                    <div className="order-card-date">{o.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                  <span className={`order-status-badge ${o.status.toLowerCase()}`}>{o.status.replace(/_/g, " ")}</span>
                  <div className="order-card-total">{formatINR(o.total)}</div>
                </Link>
              ))}
              <Link href="/account/orders" className="account-view-all">View all orders →</Link>
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
