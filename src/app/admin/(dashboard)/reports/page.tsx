import { buildFinancialReport, financialYearOf, financialYearLabel, type Period } from "@/lib/financial-report";
import { loadFinancialData } from "@/lib/financial-data";
import { formatPaise } from "@/lib/money";
import PeriodPicker from "./PeriodPicker";

export const dynamic = "force-dynamic";

// The accountant's page.
//
// The workbook was the only thing still holding the GST summary and anything
// resembling a profit statement, which is why it stayed in use months after
// everything else had moved into the app. This is that last reason removed.
//
// The figures are shown on screen as well as downloaded, on purpose: a number
// you can only see by opening a spreadsheet is a number you look at once a
// quarter, and the whole point of moving off the workbook was to stop the
// accounts being something you find out about later.

function Figure({
  label,
  paise,
  note,
  strong,
  negativeIsFine,
}: {
  label: string;
  paise: number;
  note?: string;
  strong?: boolean;
  negativeIsFine?: boolean;
}) {
  const bad = paise < 0 && !negativeIsFine;
  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}>
        <span style={{ fontSize: 13.5, fontWeight: strong ? 600 : 400 }}>{label}</span>
        <span
          style={{
            fontSize: strong ? 17 : 15,
            fontWeight: strong ? 600 : 500,
            fontVariantNumeric: "tabular-nums",
            color: bad ? "#a03c28" : undefined,
            whiteSpace: "nowrap",
          }}
        >
          {formatPaise(paise)}
        </span>
      </div>
      {note && <div style={{ fontSize: 12, color: "var(--sage)", marginTop: 2 }}>{note}</div>}
    </div>
  );
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;

  const period: Period =
    from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to
      ? { from, to }
      : financialYearOf(new Date());

  const data = await loadFinancialData(period);
  const report = buildFinancialReport({ period, ...data });
  const { pnl, gst, cash } = report;

  const query = `from=${period.from}&to=${period.to}`;
  const nothing = pnl.totals.revenuePaise === 0 && cash.totals.stockPaidPaise === 0 && cash.totals.capitalPaise === 0;

  return (
    <>
      <div className="admin-header">
        <h1>Reports</h1>
        <a href={`/api/admin/reports/financials?${query}`} className="btn btn-primary">
          Download the workbook
        </a>
      </div>

      <div className="admin-card" style={{ padding: "16px 20px", marginBottom: 18 }}>
        <PeriodPicker from={period.from} to={period.to} />
        <p style={{ fontSize: 12.5, color: "var(--sage)", margin: "10px 0 0", lineHeight: 1.7 }}>
          Showing <strong>{financialYearLabel(period)}</strong> — {period.from} to {period.to}. The Indian
          financial year runs April to March, so that is the default rather than the calendar year.
        </p>
      </div>

      {nothing && (
        <p className="notice-box">
          Nothing was recorded in this period, so every figure below is zero. Try a wider range.
        </p>
      )}

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div className="admin-card" style={{ padding: "16px 20px" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>Profit</h3>
          <Figure label="Sales" paise={pnl.totals.revenuePaise} note="GST included, refunds and cancellations excluded" />
          <Figure label="Cost of the garments sold" paise={pnl.totals.cogsPaise} negativeIsFine />
          <Figure label="Gross profit" paise={pnl.totals.grossProfitPaise} strong />
          <Figure label="Running costs" paise={pnl.totals.runningPaise} note="packaging, courier, fees — not stock" negativeIsFine />
          <Figure label="Net profit" paise={pnl.totals.netProfitPaise} strong note="before tax" />
          {pnl.cogsIncomplete && (
            <p style={{ fontSize: 12.5, color: "#a03c28", marginTop: 10, lineHeight: 1.7 }}>
              {pnl.piecesWithoutCost} sold piece{pnl.piecesWithoutCost === 1 ? "" : "s"} had no recorded cost,
              so profit here is overstated. Fill in the landed cost on those products and this corrects itself.
            </p>
          )}
        </div>

        <div className="admin-card" style={{ padding: "16px 20px" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>GST</h3>
          <Figure label="Collected on sales" paise={gst.salesTaxPaise} note="taken out of the selling price, not added to it" />
          <Figure label="Paid on stock" paise={gst.purchaseTaxPaise} note="from vendor invoices" negativeIsFine />
          <Figure label="Paid on running costs" paise={gst.expenseTaxPaise} negativeIsFine />
          <Figure
            label={gst.netPayablePaise >= 0 ? "Payable" : "Credit carried forward"}
            paise={Math.abs(gst.netPayablePaise)}
            strong
            note="your accountant decides what is actually claimable"
          />
          <p style={{ fontSize: 12, color: "var(--sage)", marginTop: 10, lineHeight: 1.7 }}>
            Garments are taxed per piece — 5% up to ₹2,500, 18% above, the rates in force since
            22 September 2025.
            {gst.expensesWithoutRate > 0 && (
              <> {gst.expensesWithoutRate} running cost{gst.expensesWithoutRate === 1 ? "" : "s"} have no
              rate recorded, so no credit is claimed on them.</>
            )}
          </p>
        </div>

        <div className="admin-card" style={{ padding: "16px 20px" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>Cash</h3>
          <Figure label="Capital put in" paise={cash.totals.capitalPaise} />
          <Figure label="Sales received" paise={cash.totals.salesReceiptsPaise} note="less anything refunded" />
          <Figure label="Paid to vendors for stock" paise={cash.totals.stockPaidPaise} negativeIsFine />
          <Figure label="Running costs paid" paise={cash.totals.runningPaidPaise} negativeIsFine />
          <Figure label="Movement in the period" paise={cash.totals.netMovementPaise} strong />
          <p style={{ fontSize: 12, color: "var(--sage)", marginTop: 10, lineHeight: 1.7 }}>
            Movement within the period, opening at zero — not a bank balance.
          </p>
        </div>
      </div>

      <div className="admin-card" style={{ padding: "16px 20px", marginTop: 18 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Month by month</h3>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table className="admin-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th>Month</th>
                <th style={{ textAlign: "right" }}>Sales</th>
                <th style={{ textAlign: "right" }}>Cost of garments</th>
                <th style={{ textAlign: "right" }}>Running costs</th>
                <th style={{ textAlign: "right" }}>Net profit</th>
                <th style={{ textAlign: "right" }}>Cash at month end</th>
              </tr>
            </thead>
            <tbody>
              {pnl.months.map((m, i) => (
                <tr key={m.key}>
                  <td style={{ whiteSpace: "nowrap" }}>{m.label}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatPaise(pnl.revenuePaise[i])}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatPaise(pnl.cogsPaise[i])}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatPaise(pnl.runningTotalPaise[i])}</td>
                  <td
                    style={{
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      color: pnl.netProfitPaise[i] < 0 ? "#a03c28" : undefined,
                    }}
                  >
                    {formatPaise(pnl.netProfitPaise[i])}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      color: cash.closingPaise[i] < 0 ? "#a03c28" : undefined,
                    }}
                  >
                    {formatPaise(cash.closingPaise[i])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card" style={{ padding: "16px 20px", marginTop: 18 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Read this before using the figures</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9, color: "var(--sage)" }}>
          {report.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
