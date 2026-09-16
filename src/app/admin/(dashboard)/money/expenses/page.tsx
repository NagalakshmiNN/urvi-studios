import { db } from "@/db";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { schema } from "@/db";
import { formatPaise, gstPortionPaise, STOCK_PURCHASE } from "@/lib/money";
import ExpenseForm from "./ExpenseForm";
import DeleteEntryButton from "../DeleteEntryButton";

/** "2026-08-26" → "26 Aug 2026", without dragging in a date library. */
function readableDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminExpensesPage() {
  const rows = await db.query.expenses.findMany({
    orderBy: [desc(schema.expenses.spentOn), desc(schema.expenses.createdAt)],
  });

  const stockPaise = rows.filter((r) => r.category === STOCK_PURCHASE).reduce((n, r) => n + r.amountPaise, 0);
  const runningPaise = rows.filter((r) => r.category !== STOCK_PURCHASE).reduce((n, r) => n + r.amountPaise, 0);

  return (
    <>
      <div className="admin-header">
        <h1>Money Out</h1>
        <Link href="/admin/money" className="btn btn-outline">See the Money Map</Link>
      </div>

      <p className="notice-box">
        Everything the business pays for. Money paid to a vendor for pieces to sell is <strong>{STOCK_PURCHASE}</strong> —
        it turns into stock rather than disappearing, so it&apos;s counted separately from running costs like
        packaging and courier. Both show up on the Money Map.
      </p>

      <div className="metric-grid" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <div className="label">Paid to vendors for stock</div>
          <div className="value">{formatPaise(stockPaise)}</div>
        </div>
        <div className="metric-card">
          <div className="label">Running costs</div>
          <div className="value">{formatPaise(runningPaise)}</div>
        </div>
        <div className="metric-card">
          <div className="label">Entries recorded</div>
          <div className="value">{rows.length}</div>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 28 }}>
        <h3 style={{ marginBottom: 16 }}>Record a spend</h3>
        <ExpenseForm />
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 14 }}>Everything so far</h3>
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>What for</th>
                <th>Kind</th>
                <th>Paid to</th>
                <th>Amount</th>
                <th>of which GST</th>
                <th>Paid by</th>
                <th>Reference</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const gst = gstPortionPaise(r.amountPaise, r.gstRateBp);
                return (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{readableDate(r.spentOn)}</td>
                    <td>{r.description}</td>
                    <td>
                      <span className={`spend-tag${r.category === STOCK_PURCHASE ? " stock" : ""}`}>{r.category}</span>
                    </td>
                    <td>{r.payee ?? "—"}</td>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{formatPaise(r.amountPaise)}</td>
                    <td style={{ color: "var(--sage)", whiteSpace: "nowrap" }}>{gst == null ? "—" : formatPaise(gst)}</td>
                    <td>{r.paymentMode}</td>
                    {/* The PO or invoice number, so a row here can be matched
                        against the paperwork without opening the workbook. */}
                    <td style={{ color: "var(--sage)" }}>
                      {r.reference ? <code style={{ fontSize: 11.5 }}>{r.reference}</code> : "—"}
                    </td>
                    <td><DeleteEntryButton id={r.id} what={r.description} kind="expense" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p style={{ padding: "20px 0 0", color: "var(--sage)" }}>
            Nothing recorded yet. Every spend added here shows up on the Money Map straight away.
          </p>
        )}
      </div>
    </>
  );
}
