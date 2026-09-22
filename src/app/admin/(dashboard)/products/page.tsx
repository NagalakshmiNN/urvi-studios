import { db } from "@/db";
import { formatINR } from "@/lib/format";
import Link from "next/link";
import { Suspense } from "react";
import ProductRow from "./ProductRow";
import ProductTableControls from "./ProductTableControls";
import ProductPager from "./ProductPager";
import { matchesSearch, paginate } from "@/lib/table-paging";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; per?: string }>;
}) {
  const { q = "", page: rawPage, per: rawPer } = await searchParams;

  // The whole catalogue is read and then filtered in memory. At a couple of
  // hundred products that is cheaper than the round trips a database-side
  // search would cost, and the search has to look at the category name, which
  // lives on a joined row. Worth revisiting somewhere north of a few thousand.
  const all = await db.query.products.findMany({
    with: { category: true, images: true },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });

  const matching = all.filter((p) => matchesSearch(p, q));
  const paging = paginate(matching.length, rawPage, rawPer);
  const products = matching.slice(paging.start, paging.end);

  const showing =
    paging.total === 0
      ? "No products match"
      : `Showing ${paging.from}–${paging.to} of ${paging.total}`;

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("per", String(paging.perPage));

  return (
    <>
      <div className="admin-header">
        <h1>Products</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/products/import" className="btn btn-outline">Import from Excel</Link>
          <Link href="/admin/products/new" className="btn btn-primary">Add Product</Link>
        </div>
      </div>

      <div className="admin-card">
        {/* useSearchParams needs a Suspense boundary around it, or the whole
            route opts out of static rendering with a build-time warning. */}
        <Suspense fallback={null}>
          <ProductTableControls total={paging.total} showing={showing} />
        </Suspense>

        {/* The table is wider than the screen — ten columns, several of them
            editable. Without this the right-hand columns (Badge, Stock) were
            simply unreachable: the page itself does not scroll sideways, so
            there was nothing to drag. */}
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Product ID</th>
              <th>Category</th>
              <th>Selling Price</th>
              <th>Landed Cost</th>
              <th>Min Round Up To</th>
              <th>Max Round Up To</th>
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
        </div>
        {products.length === 0 && (
          <p style={{ padding: 20, color: "var(--sage)" }}>
            {q ? `Nothing matches "${q}".` : "No products yet."}
          </p>
        )}
        <ProductPager paging={paging} params={params} />
      </div>
    </>
  );
}
