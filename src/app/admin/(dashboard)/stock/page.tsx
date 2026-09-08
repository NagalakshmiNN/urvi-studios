import { db } from "@/db";
import { formatINR } from "@/lib/format";
import Link from "next/link";

// One row per product per size — the plain answer to "how much of what do I
// actually have", which the dashboard's summary tables only ever hinted at.
export default async function AdminStockPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show = "all" } = await searchParams;

  const products = await db.query.products.findMany({
    with: { sizes: true, category: true },
    orderBy: (p, { asc }) => [asc(p.name)],
  });

  type Row = {
    productId: string;
    name: string;
    sku: string;
    category: string;
    size: string;
    stock: number;
    price: number;
    landedCost: number | null;
    isActive: boolean;
  };

  const rows: Row[] = [];
  for (const p of products) {
    const sizes = [...p.sizes].sort((a, b) => a.position - b.position);
    for (const s of sizes) {
      rows.push({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category.name,
        size: s.label,
        stock: s.stock,
        price: p.price,
        landedCost: p.landedCost,
        isActive: p.isActive,
      });
    }
  }

  const visible =
    show === "low"
      ? rows.filter((r) => r.stock > 0 && r.stock < 5)
      : show === "out"
      ? rows.filter((r) => r.stock === 0)
      : rows;

  const totalPieces = rows.reduce((n, r) => n + r.stock, 0);
  const retailValue = rows.reduce((n, r) => n + r.stock * r.price, 0);
  const costValue = rows.reduce((n, r) => n + r.stock * (r.landedCost ?? 0), 0);
  const rowsWithCost = rows.filter((r) => r.landedCost != null && r.stock > 0).length;
  const outOfStock = rows.filter((r) => r.stock === 0).length;
  const runningLow = rows.filter((r) => r.stock > 0 && r.stock < 5).length;

  const FILTERS = [
    { value: "all", label: `Everything (${rows.length})` },
    { value: "low", label: `Running low (${runningLow})` },
    { value: "out", label: `Sold out (${outOfStock})` },
  ];

  return (
    <>
      <div className="admin-header">
        <h1>Stock</h1>
        <a href="/api/admin/export/stock" className="btn btn-outline">Download as Excel</a>
      </div>

      <div className="metric-grid" style={{ marginBottom: 20 }}>
        <div className="metric-card">
          <div className="label">Pieces on hand</div>
          <div className="value">{totalPieces}</div>
        </div>
        <div className="metric-card">
          <div className="label">Value at selling price</div>
          <div className="value">{formatINR(retailValue)}</div>
        </div>
        <div className="metric-card">
          <div className="label">Value at landed cost</div>
          <div className="value">{costValue > 0 ? formatINR(costValue) : "—"}</div>
        </div>
        <div className="metric-card">
          <div className="label">Sold out sizes</div>
          <div className="value">{outOfStock}</div>
        </div>
      </div>

      {costValue > 0 && rowsWithCost < rows.filter((r) => r.stock > 0).length && (
        <p style={{ fontSize: 12.5, color: "var(--sage)", marginBottom: 16 }}>
          The landed-cost total only counts the products that have a Landed Cost filled in — add it on the
          Products screen or in your master sheet for the rest and this becomes your true stock-on-hand value.
        </p>
      )}

      <div className="filter-bar" style={{ marginBottom: 20 }}>
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/admin/stock" : `/admin/stock?show=${f.value}`}
            className={`chip ${show === f.value ? "active" : ""}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Product ID</th>
              <th>Category</th>
              <th>Size</th>
              <th>Pieces</th>
              <th>Selling price</th>
              <th>Value</th>
              <th>Live?</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={`${r.productId}-${r.size}`}>
                <td>
                  <Link href={`/admin/products/${r.productId}/edit`} style={{ color: "var(--olive)", fontWeight: 600 }}>
                    {r.name}
                  </Link>
                </td>
                <td><code style={{ fontSize: 12 }}>{r.sku}</code></td>
                <td>{r.category}</td>
                <td>{r.size}</td>
                <td style={{ fontWeight: 600, color: r.stock === 0 ? "#a5333a" : r.stock < 5 ? "var(--gold)" : "inherit" }}>
                  {r.stock}
                </td>
                <td>{formatINR(r.price)}</td>
                <td>{formatINR(r.stock * r.price)}</td>
                <td style={{ fontSize: 12.5, color: r.isActive ? "var(--olive)" : "var(--sage)" }}>
                  {r.isActive ? "Yes" : "Hidden"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p style={{ padding: 20, color: "var(--sage)" }}>Nothing to show here — which is good news.</p>
        )}
      </div>
    </>
  );
}
