import Link from "next/link";
import { db } from "@/db";
import { buildStockGrid, visibleColumns, cellTone } from "@/lib/stock-grid";
import { pendingReservations, heldForProduct } from "@/lib/stock-reservations";
import ProductThumb from "@/components/admin/ProductThumb";
import ReportHealthCard from "./ReportHealthCard";

export const dynamic = "force-dynamic";

// The shelf, as a picture.
//
// The Stock list answers "how much of this exact thing". This answers the
// question actually asked every morning — which sizes am I out of, across
// everything — which only works as a grid you can scan in one go.
export default async function StockGridPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { all } = await searchParams;
  const includeInactive = all === "1";

  const products = await db.query.products.findMany({
    with: { images: true, sizes: true },
    orderBy: (p, { asc }) => [asc(p.name)],
  });

  // Garments spoken for on a WhatsApp order nobody has confirmed yet. Shown
  // beside the count, never subtracted from it — the shelf still holds them.
  const holds = await pendingReservations();

  const grid = buildStockGrid(
    products.filter((p) => includeInactive || p.isActive).map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      isActive: p.isActive,
      images: p.images,
      sizes: p.sizes,
      held: heldForProduct(holds, p.id),
    }))
  );

  const columns = visibleColumns(grid);
  const outCount = grid.rows.reduce(
    (n, r) => n + columns.filter((c) => cellTone(r.cells[c], 2, r.heldCells[c]) === "out").length,
    0
  );
  const lowCount = grid.rows.reduce(
    (n, r) => n + columns.filter((c) => cellTone(r.cells[c], 2, r.heldCells[c]) === "low").length,
    0
  );
  const heldCount = grid.rows.reduce(
    (n, r) => n + columns.filter((c) => cellTone(r.cells[c], 2, r.heldCells[c]) === "held").length,
    0
  );

  return (
    <>
      <div className="admin-header">
        <h1>Stock Grid</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/stock" className="btn btn-outline">List view</Link>
          <Link href={includeInactive ? "/admin/stock/grid" : "/admin/stock/grid?all=1"} className="btn btn-outline">
            {includeInactive ? "Active only" : "Include inactive"}
          </Link>
        </div>
      </div>

      {/* Why the seven o'clock email did or didn't arrive — and the button to
          send it now, which is the fastest way to tell a broken report from a
          schedule that never fired. */}
      <ReportHealthCard />

      <div className="admin-card" style={{ padding: "18px 20px" }}>
        <p style={{ fontSize: 13, color: "var(--sage)", margin: "0 0 14px", lineHeight: 1.7 }}>
          {grid.rows.length} piece{grid.rows.length === 1 ? "" : "s"} · {grid.grandTotal} garment
          {grid.grandTotal === 1 ? "" : "s"} in hand ·{" "}
          <strong style={{ color: "#a03c28" }}>{outCount} size{outCount === 1 ? "" : "s"} out</strong> ·{" "}
          {lowCount} running low
          {grid.heldGrandTotal > 0 && (
            <> · {grid.heldGrandTotal} held for WhatsApp orders</>
          )}
          <br />
          A blank cell means the piece isn&apos;t made in that size. A zero means it is, and it&apos;s gone.
          {heldCount > 0 && (
            <>
              {" "}
              A cell marked <em>held</em> still has the garment on the shelf, but it&apos;s
              already promised on a WhatsApp order nobody has confirmed yet — so
              it isn&apos;t really yours to sell.
            </>
          )}
        </p>

        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table className="stock-grid">
            <thead>
              <tr>
                <th className="sg-piece">Piece</th>
                {columns.map((c) => (
                  <th key={c} className="sg-size">{c}</th>
                ))}
                <th className="sg-size">Total</th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr key={row.id}>
                  <td className="sg-piece">
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <ProductThumb url={row.imageUrl} name={row.name} />
                      <div style={{ minWidth: 0 }}>
                        <div className="sg-name">
                          {row.name}
                          {!row.isActive && <span className="sg-inactive"> · not live</span>}
                        </div>
                        <div className="sg-code">{row.code}</div>
                        {row.other.length > 0 && (
                          <div className="sg-other">
                            {row.other.map((o) => `${o.label} ${o.stock}`).join(" · ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {columns.map((c) => {
                    const value = row.cells[c];
                    const held = row.heldCells[c];
                    return (
                      <td key={c} className={`sg-cell sg-${cellTone(value, 2, held)}`}>
                        {value === null ? "" : value}
                        {/* The count stays the shelf count; the hold is shown
                            beside it, because subtracting one would say a
                            garment isn't there when it is hanging on the rail. */}
                        {held > 0 && <span className="sg-held-mark"> ({held} held)</span>}
                      </td>
                    );
                  })}
                  <td className="sg-cell sg-total">{row.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className="sg-piece">All pieces</th>
                {columns.map((c) => (
                  <th key={c} className="sg-cell sg-total">{grid.columnTotals[c]}</th>
                ))}
                <th className="sg-cell sg-total">{grid.grandTotal}</th>
              </tr>
            </tfoot>
          </table>
        </div>

        {grid.rows.length === 0 && (
          <p style={{ padding: 20, color: "var(--sage)" }}>Nothing in the catalogue yet.</p>
        )}
      </div>
    </>
  );
}
