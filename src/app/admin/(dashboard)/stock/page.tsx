import { db } from "@/db";
import { formatINR } from "@/lib/format";
import { markupPercent } from "@/lib/markup";
import Link from "next/link";
import ProductThumb, { firstImageUrl } from "@/components/admin/ProductThumb";

// A round-up price with its markup over landed cost as a small corner badge —
// the read-only twin of the editable version on the Products screen, so a
// margin can be judged here without switching pages or doing the arithmetic.
function MarkupFigure({ value, landedCost }: { value: number | null; landedCost: number | null }) {
  if (value == null) return <span className="markup-value empty">—</span>;
  const pct = markupPercent(value, landedCost);
  return (
    <div className={`markup-box${pct != null ? " has-badge" : ""}`}>
      {pct != null && (
        <span className={`markup-badge${pct < 0 ? " negative" : ""}`}>
          {pct >= 0 ? "+" : ""}{pct}%
        </span>
      )}
      <span className="markup-value">{formatINR(value)}</span>
    </div>
  );
}

// 100 size-rows to a page. The whole catalog is a few hundred rows, so this is
// about keeping the screen readable rather than about database load.
const PAGE_SIZE = 100;

// One row per product per size — the plain answer to "how much of what do I
// actually have", which the dashboard's summary tables only ever hinted at.
export default async function AdminStockPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; q?: string; page?: string; sort?: string }>;
}) {
  const { show = "all", q = "", page: pageParam, sort = "name" } = await searchParams;
  const search = q.trim();

  const products = await db.query.products.findMany({
    with: { sizes: true, images: true },
    orderBy: (p, { asc }) => [asc(p.name)],
  });

  type Row = {
    productId: string;
    name: string;
    sku: string;
    image: string | null;
    size: string;
    stock: number;
    price: number;
    landedCost: number | null;
    minRoundUpTo: number | null;
    maxRoundUpTo: number | null;
    isActive: boolean;
  };

  const rows: Row[] = [];
  for (const p of products) {
    const sizes = [...p.sizes].sort((a, b) => a.position - b.position);
    // The product's own first photo — the same one the storefront leads with,
    // so what's on this screen matches what she'd recognise on the rail.
    const image = firstImageUrl(p.images);
    for (const s of sizes) {
      rows.push({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        image,
        size: s.label,
        stock: s.stock,
        price: p.price,
        landedCost: p.landedCost,
        minRoundUpTo: p.minRoundUpTo,
        maxRoundUpTo: p.maxRoundUpTo,
        isActive: p.isActive,
      });
    }
  }

  // Search matches the name or the Product ID, so either a half-remembered
  // product or an ID copied out of the master sheet finds the row.
  const needle = search.toLowerCase();
  const searched = needle
    ? rows.filter((r) => r.name.toLowerCase().includes(needle) || r.sku.toLowerCase().includes(needle))
    : rows;

  const filtered =
    show === "low"
      ? searched.filter((r) => r.stock > 0 && r.stock < 5)
      : show === "out"
      ? searched.filter((r) => r.stock === 0)
      : searched;

  // Sorting happens after filtering and before paging, so "cheapest first"
  // means the cheapest of what's actually being shown — and page 1 really is
  // the cheapest 100, not the first 100 alphabetically then sorted.
  //
  // Every sort falls back to name, then size, so rows of the same price keep
  // a stable, readable order instead of shuffling between page loads.
  const byName = (a: Row, b: Row) => a.name.localeCompare(b.name) || a.size.localeCompare(b.size);
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "price-asc") return a.price - b.price || byName(a, b);
    if (sort === "price-desc") return b.price - a.price || byName(a, b);
    if (sort === "stock-asc") return a.stock - b.stock || byName(a, b);
    return byName(a, b);
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(pageParam) || 1), pageCount);
  const visible = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // The totals describe what the search is showing, not the whole catalog —
  // searching "co-ord" and reading the whole-catalog value would be worse than
  // useless. With no search they are the same thing.
  const totalPieces = searched.reduce((n, r) => n + r.stock, 0);
  const retailValue = searched.reduce((n, r) => n + r.stock * r.price, 0);
  const costValue = searched.reduce((n, r) => n + r.stock * (r.landedCost ?? 0), 0);
  const rowsWithCost = searched.filter((r) => r.landedCost != null && r.stock > 0).length;
  const outOfStock = searched.filter((r) => r.stock === 0).length;
  const runningLow = searched.filter((r) => r.stock > 0 && r.stock < 5).length;

  /** A link back to this screen keeping whatever isn't being changed. */
  function href(next: { show?: string; page?: number; sort?: string }) {
    const params = new URLSearchParams();
    const nextShow = next.show ?? show;
    if (nextShow && nextShow !== "all") params.set("show", nextShow);
    if (search) params.set("q", search);
    const nextSort = next.sort ?? sort;
    if (nextSort && nextSort !== "name") params.set("sort", nextSort);
    // Changing the filter or the sort always returns to page one — page 4 of
    // the old order is meaningless in the new one, and there may be no page 4.
    const changedView = next.show !== undefined || next.sort !== undefined;
    const nextPage = next.page ?? (changedView ? 1 : currentPage);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/admin/stock?${qs}` : "/admin/stock";
  }

  const FILTERS = [
    { value: "all", label: `Everything (${searched.length})` },
    { value: "low", label: `Running low (${runningLow})` },
    { value: "out", label: `Sold out (${outOfStock})` },
  ];

  /** Same screen, same filter and order, without the search term. */
  function clearSearchHref() {
    const params = new URLSearchParams();
    if (show !== "all") params.set("show", show);
    if (sort !== "name") params.set("sort", sort);
    const qs = params.toString();
    return qs ? `/admin/stock?${qs}` : "/admin/stock";
  }

  const SORTS = [
    { value: "name", label: "A–Z" },
    { value: "price-asc", label: "Price: Low to High" },
    { value: "price-desc", label: "Price: High to Low" },
    { value: "stock-asc", label: "Fewest pieces first" },
  ];

  const firstShown = sorted.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastShown = (currentPage - 1) * PAGE_SIZE + visible.length;

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

      {costValue > 0 && rowsWithCost < searched.filter((r) => r.stock > 0).length && (
        <p style={{ fontSize: 12.5, color: "var(--sage)", marginBottom: 16 }}>
          The landed-cost total only counts the products that have a Landed Cost filled in — add it on the
          Products screen or in your master sheet for the rest and this becomes your true stock-on-hand value.
        </p>
      )}

      <div className="stock-toolbar">
        {/* A plain GET form, so a search survives a refresh and can be
            bookmarked or shared as a URL. */}
        <form className="stock-search" action="/admin/stock" method="get">
          {show !== "all" && <input type="hidden" name="show" value={show} />}
          {/* Searching must not silently reset the chosen order. */}
          {sort !== "name" && <input type="hidden" name="sort" value={sort} />}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search by product name or Product ID"
            aria-label="Search stock"
            className="admin-inline-input"
          />
          <button type="submit" className="btn btn-outline btn-sm">Search</button>
          {/* Clearing the search clears only the search — the filter and the
              chosen order are still what she picked. */}
          {search && (
            <Link href={clearSearchHref()} className="link-btn">
              Clear
            </Link>
          )}
        </form>

        <div className="stock-filters">
          {FILTERS.map((f) => (
            <Link key={f.value} href={href({ show: f.value })} className={`chip ${show === f.value ? "active" : ""}`}>
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Sorting sits under the filters because that's the order it's used in:
          narrow down to what you're looking at, then decide how to read it. */}
      <div className="stock-sorts">
        <span className="stock-sorts-label">Sort by</span>
        {SORTS.map((s) => (
          <Link key={s.value} href={href({ sort: s.value })} className={`chip ${sort === s.value ? "active" : ""}`}>
            {s.label}
          </Link>
        ))}
      </div>

      {search && (
        <p style={{ fontSize: 12.5, color: "var(--sage)", marginBottom: 14 }}>
          Showing matches for “{search}” — the totals above count these rows only.
        </p>
      )}

      <div className="admin-card stock-card">
        <div className="table-scroll">
          <table className="admin-table stock-table">
            <colgroup>
              <col />
              <col style={{ width: 136 }} />
              <col style={{ width: 54 }} />
              <col style={{ width: 62 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 58 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Product</th>
                <th>Product ID</th>
                <th>Size</th>
                <th>Pieces</th>
                <th>Selling price</th>
                <th>Min round up</th>
                <th>Max round up</th>
                <th>Live?</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={`${r.productId}-${r.size}`}>
                  <td>
                    <Link href={`/admin/products/${r.productId}/edit`} className="stock-product">
                      <ProductThumb url={r.image} name={r.name} />
                      <span>{r.name}</span>
                    </Link>
                  </td>
                  <td><code style={{ fontSize: 11.5 }}>{r.sku}</code></td>
                  <td>{r.size}</td>
                  <td style={{ fontWeight: 600, color: r.stock === 0 ? "#a5333a" : r.stock < 5 ? "var(--gold)" : "inherit" }}>
                    {r.stock}
                  </td>
                  <td>{formatINR(r.price)}</td>
                  <td><MarkupFigure value={r.minRoundUpTo} landedCost={r.landedCost} /></td>
                  <td><MarkupFigure value={r.maxRoundUpTo} landedCost={r.landedCost} /></td>
                  <td style={{ fontSize: 12.5, color: r.isActive ? "var(--olive)" : "var(--sage)" }}>
                    {r.isActive ? "Yes" : "Hidden"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <p style={{ padding: 20, color: "var(--sage)" }}>
            {search ? `Nothing matches “${search}”.` : "Nothing to show here — which is good news."}
          </p>
        )}
      </div>

      {pageCount > 1 && (
        <div className="stock-pager">
          <span>
            Showing {firstShown}–{lastShown} of {sorted.length}
          </span>
          <div className="stock-pager-links">
            <Link
              href={href({ page: currentPage - 1 })}
              className={`chip ${currentPage === 1 ? "disabled" : ""}`}
              aria-disabled={currentPage === 1}
            >
              Previous
            </Link>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={href({ page: n })} className={`chip ${n === currentPage ? "active" : ""}`}>
                {n}
              </Link>
            ))}
            <Link
              href={href({ page: currentPage + 1 })}
              className={`chip ${currentPage === pageCount ? "disabled" : ""}`}
              aria-disabled={currentPage === pageCount}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
