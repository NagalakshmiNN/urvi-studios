import { db } from "@/db";
import { formatINR } from "@/lib/format";
import Link from "next/link";
import ProductRow from "./ProductRow";

export default async function AdminProductsPage() {
  const products = await db.query.products.findMany({
    with: { category: true, images: true },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });

  return (
    <>
      <div className="admin-header">
        <h1>Products</h1>
        <Link href="/admin/products/new" className="btn btn-primary">Add Product</Link>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Compare-at</th>
              <th>Badge</th>
              <th>Stock</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <ProductRow key={p.id} product={p} />
            ))}
          </tbody>
        </table>
        {products.length === 0 && <p style={{ padding: 20, color: "var(--sage)" }}>No products yet.</p>}
      </div>
    </>
  );
}
