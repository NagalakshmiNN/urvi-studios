import { db } from "@/db";
import { formatINR } from "@/lib/format";
import { markupPercent } from "@/lib/markup";
import Link from "next/link";

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
  searchParams: Promise<{ show?: string; q?: string; page?: string }>;
}) {
  const { show = "all", q = "", page: pageParam } = await searchParams;
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
    const image = [...p.images].sort((a, b) => a.position - b.position)[0]?.url ?? null;
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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(pageParam) || 1), pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
  function href(next: { show?: string; page?: number }) {
    const params = new URLSearchParams();
    const nextShow = next.show ?? show;
    if (nextShow && nextShow !== "all") params.set("show", nextShow);
    if (search) params.set("q", search);
    // Changing the filter always returns to page one; there may be no page 4.
    const nextPage = next.page ?? (next.show !== undefined ? 1 : currentPage);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/admin/stock?${qs}` : "/admin/stock";
  }

  const FILTERS = [
    { value: "all", label: `Everything (${searched.length})` },
    { value: "low", label: `Running low (${runningLow})` },
    { value: "out", label: `Sold out (${outOfStock})` },
  ];

  const firstShown = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
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
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search by product name or Product ID"
            aria-label="Search stock"
            className="admin-inline-input"
          />
          <button type="submit" className="btn btn-outline btn-sm">Search</button>
          {search && (
            <Link href={show === "all" ? "/admin/stock" : `/admin/stock?show=${show}`} className="link-btn">
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
                      {r.image ? (
                        <img src={r.image} alt="" className="stock-thumb" />
                      ) : (
                        <span className="stock-thumb stock-thumb-empty" aria-hidden="true" />
                      )}
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
            Showing {firstShown}–{lastShown} of {filtered.length}
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
