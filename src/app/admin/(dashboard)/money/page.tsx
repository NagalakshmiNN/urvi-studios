import { db } from "@/db";
import Link from "next/link";
import { buildMoneyPicture, formatPaise, STOCK_PURCHASE } from "@/lib/money";
import MoneyFlow, { type FlowRow } from "@/components/admin/MoneyFlow";

// The whole-business picture, computed from this database rather than from a
// spreadsheet — so it is right the moment anything is recorded, instead of
// being right on the day someone last exported it.
//
// The one idea this page is built around: money paid to a vendor for stock has
// not been spent the way a courier bill has been spent. It has been turned
// into something on the rail that can still be sold. So the page reports cash
// and stock separately, and only calls the difference a loss where it really
// is one.

export default async function AdminMoneyMapPage() {
  const [capital, expenses, orders, products] = await Promise.all([
    db.query.capitalContributions.findMany(),
    db.query.expenses.findMany(),
    db.query.orders.findMany({ with: { items: true } }),
    db.query.products.findMany(),
  ]);

  const picture = buildMoneyPicture({
    capital,
    expenses,
    orders,
    stock: products.map((p) => ({ stock: p.stock, landedCost: p.landedCost, price: p.price })),
  });

  const flowRows: FlowRow[] = [
    { label: "Capital you put in", paise: picture.capitalInPaise, kind: "in" },
    { label: "Sales", paise: picture.revenuePaise, kind: "in", note: "every channel" },
    { label: "Paid to vendors for stock", paise: picture.stockPurchasePaise, kind: "stock", note: "becomes stock, not a cost" },
    { label: "Running costs", paise: picture.runningCostsPaise, kind: "out", note: "packaging, courier, fees" },
  ];

  const nothingRecorded =
    picture.capitalInPaise === 0 && picture.stockPurchasePaise === 0 && picture.runningCostsPaise === 0;

  const cashNegative = picture.cashPaise < 0;
  const worthNegative = picture.netWorthPaise < 0;

  return (
    <>
      <div className="admin-header">
        <h1>Money Map</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/money/capital" className="btn btn-outline">Money In</Link>
          <Link href="/admin/money/expenses" className="btn btn-primary">Record a spend</Link>
        </div>
      </div>

      {nothingRecorded && (
        <p className="notice-box">
          Nothing has been recorded on the money-out side yet, so this page is only counting sales. Add what you
          put in under <strong>Money In</strong> and what you&apos;ve paid out under <strong>Record a spend</strong>,
          and everything below fills in.
        </p>
      )}

      <div className="metric-grid" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <div className="label">Cash position</div>
          <div className="value" style={{ color: cashNegative ? "#a5333a" : "inherit" }}>
            {formatPaise(picture.cashPaise)}
          </div>
          <div className="metric-sub">what&apos;s left of the money in, after buying stock and paying costs</div>
        </div>
        <div className="metric-card">
          <div className="label">Stock on the rail</div>
          <div className="value">{formatPaise(picture.stockAtCostPaise)}</div>
          <div className="metric-sub">at cost · {formatPaise(picture.stockAtRetailPaise)} at your selling prices</div>
        </div>
        <div className="metric-card">
          <div className="label">What the business is worth</div>
          <div className="value" style={{ color: worthNegative ? "#a5333a" : "inherit" }}>
            {formatPaise(picture.netWorthPaise)}
          </div>
          <div className="metric-sub">cash plus the cost value of unsold stock</div>
        </div>
        <div className="metric-card">
          <div className="label">Trading profit so far</div>
          <div className="value" style={{ color: picture.tradingProfitPaise < 0 ? "#a5333a" : "inherit" }}>
            {formatPaise(picture.tradingProfitPaise)}
          </div>
          <div className="metric-sub">sales, less what those pieces cost, less running costs</div>
        </div>
      </div>

      {cashNegative && !worthNegative && (
        <p className="notice-box">
          Cash reads negative because more has gone out than has come in — but most of it went into stock, which is
          still yours to sell. That&apos;s the normal shape of a young retail business, not a hole:{" "}
          <strong>{formatPaise(picture.stockAtCostPaise)}</strong> of it is sitting on the rail, listed at{" "}
          <strong>{formatPaise(picture.stockAtRetailPaise)}</strong>.
        </p>
      )}

      <div className="admin-card" style={{ marginBottom: 28 }}>
        <h3 style={{ marginBottom: 4 }}>Where the money went</h3>
        <p style={{ fontSize: 12.5, color: "var(--sage)", marginBottom: 20 }}>
          Every stream to the same scale, so the big ones are obvious at a glance.
        </p>
        <MoneyFlow rows={flowRows} />
      </div>

      {picture.runningCostsByCategory.length > 0 && (
        <div className="admin-card" style={{ marginBottom: 28 }}>
          <h3 style={{ marginBottom: 4 }}>Running costs, by kind</h3>
          <p style={{ fontSize: 12.5, color: "var(--sage)", marginBottom: 14 }}>
            Stock purchases are left out — they&apos;re on the chart above, as stock rather than as a cost.
          </p>
          <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr><th>Kind</th><th>Spent</th><th>Share</th></tr>
            </thead>
            <tbody>
              {picture.runningCostsByCategory.map((c) => {
                const share =
                  picture.runningCostsPaise > 0 ? Math.round((c.paise / picture.runningCostsPaise) * 100) : 0;
                return (
                  <tr key={c.category}>
                    <td>{c.category}</td>
                    <td style={{ fontWeight: 600 }}>{formatPaise(c.paise)}</td>
                    <td>
                      <div className="share-bar">
                        <span style={{ "--share": `${share}%` } as React.CSSProperties} />
                        <em>{share}%</em>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <div className="admin-card">
        <h3 style={{ marginBottom: 14 }}>How this adds up</h3>
        <table className="admin-table money-ledger">
          <tbody>
            <tr>
              <td>Capital you put in</td>
              <td className="pos">+{formatPaise(picture.capitalInPaise)}</td>
            </tr>
            <tr>
              <td>Sales, every channel</td>
              <td className="pos">+{formatPaise(picture.revenuePaise)}</td>
            </tr>
            <tr>
              <td>Paid to vendors for stock</td>
              <td className="neg">−{formatPaise(picture.stockPurchasePaise)}</td>
            </tr>
            <tr>
              <td>Running costs</td>
              <td className="neg">−{formatPaise(picture.runningCostsPaise)}</td>
            </tr>
            <tr className="total">
              <td>Cash in hand</td>
              <td>{formatPaise(picture.cashPaise)}</td>
            </tr>
            <tr>
              <td>Stock still unsold, at cost</td>
              <td className="pos">+{formatPaise(picture.stockAtCostPaise)}</td>
            </tr>
            <tr className="total grand">
              <td>What the business is worth</td>
              <td>{formatPaise(picture.netWorthPaise)}</td>
            </tr>
          </tbody>
        </table>

        {(picture.costIncomplete || picture.stockCostIncomplete) && (
          <div className="money-caveats">
            {picture.costIncomplete && (
              <p>
                Some pieces that have sold have no landed cost recorded, so trading profit is flattering. Filling in
                Landed Cost on the Products screen corrects it.
              </p>
            )}
            {picture.stockCostIncomplete && (
              <p>
                Some stock on the rail has no landed cost recorded, so it&apos;s counted at ₹0 here — the real value
                of what you&apos;re holding is higher than the figure above.
              </p>
            )}
          </div>
        )}

        <p style={{ fontSize: 12, color: "var(--sage)", marginTop: 16, lineHeight: 1.7 }}>
          Money paid to a vendor buys stock rather than disappearing, which is why it&apos;s shown as its own line
          and added back at cost on the row above. Record a vendor payment under{" "}
          <Link href="/admin/money/expenses">Record a spend</Link> with the kind set to{" "}
          <strong>{STOCK_PURCHASE}</strong> and it lands in the right place automatically.
        </p>
      </div>
    </>
  );
}
