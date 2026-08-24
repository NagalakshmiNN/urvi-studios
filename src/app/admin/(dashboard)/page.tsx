import { db, schema } from "@/db";
import { desc, sql, lt } from "drizzle-orm";
import { formatINR } from "@/lib/format";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const [{ count: orderCount } = { count: 0 }] = await db.select({ count: sql<number>`count(*)` }).from(schema.orders);
  const [{ revenue } = { revenue: 0 }] = await db
    .select({ revenue: sql<number>`coalesce(sum(${schema.orders.total}), 0)` })
    .from(schema.orders)
    .where(sql`${schema.orders.paymentStatus} = 'PAID'`);
  const [{ count: pendingCount } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.orders)
    .where(sql`${schema.orders.status} in ('PLACED', 'CONFIRMED')`);
  const lowStock = await db.query.products.findMany({ where: lt(schema.products.stock, 5), orderBy: schema.products.stock });
  const recentOrders = await db.query.orders.findMany({ orderBy: desc(schema.orders.createdAt), limit: 8 });

  return (
    <>
      <div className="admin-header">
        <h1>Dashboard</h1>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="label">Total Orders</div>
          <div className="value">{orderCount}</div>
        </div>
        <div className="metric-card">
          <div className="label">Revenue (Paid)</div>
          <div className="value">{formatINR(revenue)}</div>
        </div>
        <div className="metric-card">
          <div className="label">Needs Action</div>
          <div className="value">{pendingCount}</div>
        </div>
        <div className="metric-card">
          <div className="label">Low Stock</div>
          <div className="value">{lowStock.length}</div>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="admin-card" style={{ marginBottom: 28 }}>
          <h3 style={{ marginBottom: 14 }}>Low Stock</h3>
          <table className="admin-table">
            <thead>
              <tr><th>Product</th><th>Stock</th><th></th></tr>
            </thead>
            <tbody>
              {lowStock.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.stock}</td>
                  <td><Link href="/admin/products" className="link-btn">Update</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-card">
        <h3 style={{ marginBottom: 14 }}>Recent Orders</h3>
        <table className="admin-table">
          <thead>
            <tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th>Total</th></tr>
          </thead>
          <tbody>
            {recentOrders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.orderNumber}`}>{o.orderNumber}</Link></td>
                <td>{o.customerName}</td>
                <td><span className={`order-status-badge ${o.status.toLowerCase()}`}>{o.status.replace(/_/g, " ")}</span></td>
                <td>{o.paymentStatus}</td>
                <td>{formatINR(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
