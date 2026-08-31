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

  // Stock is tracked per size (product_sizes.stock is the source of truth;
  // products.stock is kept as a synced total) — so this is a real
  // size-by-size breakdown, not an approximation from the product total.
  const allProducts = await db.query.products.findMany({ with: { sizes: true } });
  const totalUnits = allProducts.reduce((sum, p) => sum + p.stock, 0);
  const activeUnits = allProducts.filter((p) => p.isActive).reduce((sum, p) => sum + p.stock, 0);

  const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "FREE SIZE", "ONE SIZE"];
  const bySize = new Map<string, { units: number; items: { name: string; stock: number }[] }>();
  const lowStockSizes: { productName: string; size: string; stock: number }[] = [];
  for (const p of allProducts) {
    for (const s of p.sizes) {
      const label = s.label.trim();
      if (!bySize.has(label)) bySize.set(label, { units: 0, items: [] });
      const entry = bySize.get(label)!;
      entry.units += s.stock;
      entry.items.push({ name: p.name, stock: s.stock });
      if (p.isActive && s.stock < 5) lowStockSizes.push({ productName: p.name, size: label, stock: s.stock });
    }
  }
  lowStockSizes.sort((a, b) => a.stock - b.stock);
  const sizeRows = [...bySize.entries()].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a[0].toUpperCase());
    const bi = SIZE_ORDER.indexOf(b[0].toUpperCase());
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a[0].localeCompare(b[0]);
  });

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

      <div className="admin-card" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <h3>Stock Overview</h3>
          <span style={{ fontSize: 13, color: "var(--sage)" }}>
            <strong style={{ color: "var(--olive)" }}>{totalUnits}</strong> units total ·{" "}
            <strong style={{ color: "var(--olive)" }}>{activeUnits}</strong> in live products
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--sage)", marginBottom: 16 }}>
          Pieces on hand, size by size, across every product that comes in that size.
        </p>
        <table className="admin-table">
          <thead>
            <tr><th>Size</th><th>Products</th><th>Units</th><th>What&apos;s in it</th></tr>
          </thead>
          <tbody>
            {sizeRows.map(([label, data]) => (
              <tr key={label}>
                <td style={{ fontWeight: 600 }}>{label}</td>
                <td>{data.items.length}</td>
                <td>{data.units}</td>
                <td style={{ fontSize: 12.5, color: "var(--earth)" }}>
                  {data.items.map((it) => `${it.name} (${it.stock})`).join(", ")}
                </td>
              </tr>
            ))}
            {sizeRows.length === 0 && (
              <tr><td colSpan={4} style={{ color: "var(--sage)" }}>No sizes on any product yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {lowStockSizes.length > 0 && (
        <div className="admin-card" style={{ marginBottom: 28 }}>
          <h3 style={{ marginBottom: 4 }}>Running Low, By Size</h3>
          <p style={{ fontSize: 12.5, color: "var(--sage)", marginBottom: 14 }}>
            Fewer than 5 pieces left in this specific size — even if the product overall still looks fine.
          </p>
          <table className="admin-table">
            <thead>
              <tr><th>Product</th><th>Size</th><th>Pieces left</th></tr>
            </thead>
            <tbody>
              {lowStockSizes.map((row, i) => (
                <tr key={i}>
                  <td>{row.productName}</td>
                  <td style={{ fontWeight: 600 }}>{row.size}</td>
                  <td style={{ color: row.stock === 0 ? "#a5333a" : "inherit" }}>{row.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="admin-card" style={{ marginBottom: 28 }}>
          <h3 style={{ marginBottom: 14 }}>Low Stock — Overall</h3>
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
