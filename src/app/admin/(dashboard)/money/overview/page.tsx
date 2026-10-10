import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { formatPaise, STOCK_PURCHASE } from "@/lib/money";
import CapitalForm from "../capital/CapitalForm";

function readableDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "2026-08" → "Aug 2026" */
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

const NOT_A_SALE = new Set(["CANCELLED", "RETURNED"]);

export default async function MoneyOverviewPage() {
  const [capitalRows, expenseRows, orderRows] = await Promise.all([
    db.query.capitalContributions.findMany({
      orderBy: [desc(schema.capitalContributions.contributedOn)],
    }),
    db.query.expenses.findMany({
      orderBy: [desc(schema.expenses.spentOn)],
    }),
    db.query.orders.findMany(),
  ]);

  // ── Partner contributions ──
  const totalCapitalPaise = capitalRows.reduce((n, r) => n + r.amountPaise, 0);
  const byPerson = new Map<string, number>();
  for (const r of capitalRows) {
    byPerson.set(r.contributor, (byPerson.get(r.contributor) ?? 0) + r.amountPaise);
  }
  const people = [...byPerson.entries()].sort((a, b) => b[1] - a[1]);

  // ── Month-wise pooling ──
  type MonthBucket = { key: string; byPerson: Map<string, number>; total: number };
  const monthMap = new Map<string, MonthBucket>();
  for (const r of capitalRows) {
    const key = r.contributedOn.slice(0, 7); // "YYYY-MM"
    let bucket = monthMap.get(key);
    if (!bucket) {
      bucket = { key, byPerson: new Map(), total: 0 };
      monthMap.set(key, bucket);
    }
    bucket.byPerson.set(r.contributor, (bucket.byPerson.get(r.contributor) ?? 0) + r.amountPaise);
    bucket.total += r.amountPaise;
  }
  const months = [...monthMap.values()].sort((a, b) => a.key.localeCompare(b.key));
  const allContributors = people.map(([name]) => name);

  // ── Procurement (stock purchase expenses) ──
  const procurementRows = expenseRows.filter((e) => e.category === STOCK_PURCHASE);
  const totalProcurementPaise = procurementRows.reduce((n, r) => n + r.amountPaise, 0);

  // ── Reconciliation ──
  const differencePaise = totalCapitalPaise - totalProcurementPaise;

  // ── Sales collections ──
  const paidOrders = orderRows.filter(
    (o) => o.paymentStatus === "PAID" && !NOT_A_SALE.has(o.status)
  );
  const totalSalesPaise = paidOrders.reduce((n, o) => {
    if (o.actualSalePricePaise != null) return n + o.actualSalePricePaise;
    return n + Math.round(o.total * 100);
  }, 0);
  const hasSales = paidOrders.length > 0;

  return (
    <>
      <div className="admin-header">
        <h1>Money Overview</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/money" className="btn btn-outline">
            Money Map
          </Link>
          <Link href="/admin/money/expenses" className="btn btn-primary">
            Record a spend
          </Link>
        </div>
      </div>

      <p className="notice-box">
        How partner contributions flow into procurement. Every figure updates
        automatically when a contribution or invoice is recorded.
      </p>

      {/* ════════ SECTION 1: FINANCIAL SUMMARY ════════ */}
      <div className="metric-grid" style={{ marginBottom: 28 }}>
        <div className="metric-card">
          <div className="label">Partner Contributions</div>
          <div className="value">{formatPaise(totalCapitalPaise)}</div>
        </div>
        <div className="metric-card">
          <div className="label">Procurement Invoices</div>
          <div className="value">{formatPaise(totalProcurementPaise)}</div>
        </div>
        <div className="metric-card">
          <div className="label">Difference</div>
          <div
            className="value"
            style={{
              color:
                differencePaise === 0
                  ? "#00806B"
                  : differencePaise > 0
                    ? "var(--olive)"
                    : "#a5333a",
            }}
          >
            {differencePaise === 0
              ? "₹0"
              : differencePaise > 0
                ? `+${formatPaise(differencePaise)}`
                : `−${formatPaise(Math.abs(differencePaise))}`}
          </div>
          <div className="metric-sub" style={{ fontSize: 11 }}>
            {differencePaise === 0
              ? "Contributions match procurement exactly"
              : differencePaise > 0
                ? "Unspent capital still in hand"
                : "Procurement exceeds recorded contributions"}
          </div>
        </div>
        {hasSales && (
          <div className="metric-card">
            <div className="label">Sales Collections</div>
            <div className="value" style={{ color: "#00806B" }}>
              {formatPaise(totalSalesPaise)}
            </div>
            <div className="metric-sub" style={{ fontSize: 11 }}>
              Held separately · {paidOrders.length} paid order{paidOrders.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>

      {/* ════════ SECTION 2: PARTNER CONTRIBUTIONS ════════ */}
      <div className="admin-card" style={{ marginBottom: 22 }}>
        <h3 style={{ marginBottom: 4 }}>Partner Contributions</h3>
        <p
          style={{
            fontSize: 12,
            color: "var(--sage)",
            marginBottom: 18,
            lineHeight: 1.5,
          }}
        >
          Total money each partner put into the business. There is no separate
          initial investment — these are the agreed totals.
        </p>

        {people.length > 0 ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(people.length, 3)}, 1fr)`,
                gap: 14,
                marginBottom: 14,
              }}
            >
              {people.map(([name, paise], i) => {
                const pct =
                  totalCapitalPaise > 0
                    ? Math.round((paise / totalCapitalPaise) * 100)
                    : 0;
                const colors = [
                  { bg: "rgba(0,128,107,0.07)", border: "#00806B" },
                  { bg: "rgba(169,130,56,0.07)", border: "var(--gold)" },
                  { bg: "rgba(63,72,39,0.06)", border: "var(--sage)" },
                ];
                const c = colors[i % colors.length];
                return (
                  <div
                    key={name}
                    style={{
                      background: c.bg,
                      borderLeft: `3px solid ${c.border}`,
                      borderRadius: 6,
                      padding: "14px 16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase" as const,
                        color: c.border,
                        marginBottom: 4,
                      }}
                    >
                      {name}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 24,
                        fontWeight: 700,
                      }}
                    >
                      {formatPaise(paise)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--sage)", marginTop: 2 }}>
                      {pct}% of capital
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Equity bar */}
            <div
              style={{
                display: "flex",
                height: 22,
                borderRadius: 6,
                overflow: "hidden",
                background: "var(--sand)",
              }}
            >
              {people.map(([name, paise], i) => {
                const pct =
                  totalCapitalPaise > 0
                    ? Math.round((paise / totalCapitalPaise) * 100)
                    : 0;
                const bgColors = ["#00806B", "var(--gold)", "var(--sage)"];
                return (
                  <div
                    key={name}
                    style={{
                      width: `${pct}%`,
                      background: bgColors[i % bgColors.length],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#fff",
                    }}
                  >
                    {pct}%
                  </div>
                );
              })}
            </div>

            <div
              style={{
                textAlign: "center" as const,
                fontSize: 13,
                color: "var(--sage)",
                marginTop: 12,
                paddingTop: 10,
                borderTop: "1px dashed var(--line)",
              }}
            >
              Combined total:{" "}
              <strong
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 20,
                  color: "var(--earth)",
                }}
              >
                {formatPaise(totalCapitalPaise)}
              </strong>
            </div>
          </>
        ) : (
          <p style={{ color: "var(--sage)" }}>
            No contributions recorded yet.{" "}
            <Link href="/admin/money/capital" style={{ color: "var(--gold)", textDecoration: "underline" }}>
              Record one →
            </Link>
          </p>
        )}
      </div>

      {/* ════════ SECTION 3: MONTH-WISE POOLING ════════ */}
      {months.length > 0 && (
        <div className="admin-card" style={{ marginBottom: 22 }}>
          <h3 style={{ marginBottom: 4 }}>Month-wise Pooling</h3>
          <p
            style={{
              fontSize: 12,
              color: "var(--sage)",
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            How money was pooled over time to procure goods from vendors.
          </p>

          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Month</th>
                  {allContributors.map((name) => (
                    <th key={name}>{name}</th>
                  ))}
                  <th style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.key}>
                    <td style={{ fontWeight: 600 }}>{monthLabel(m.key)}</td>
                    {allContributors.map((name) => (
                      <td key={name}>
                        {m.byPerson.get(name)
                          ? formatPaise(m.byPerson.get(name)!)
                          : "—"}
                      </td>
                    ))}
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 600,
                        fontFamily: "var(--font-display)",
                        fontSize: 16,
                      }}
                    >
                      {formatPaise(m.total)}
                    </td>
                  </tr>
                ))}
                <tr
                  style={{
                    borderTop: "2px solid var(--olive)",
                    fontWeight: 700,
                  }}
                >
                  <td>Total</td>
                  {allContributors.map((name) => (
                    <td key={name} style={{ fontWeight: 600 }}>
                      {formatPaise(byPerson.get(name) ?? 0)}
                    </td>
                  ))}
                  <td
                    style={{
                      textAlign: "right",
                      fontFamily: "var(--font-display)",
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    {formatPaise(totalCapitalPaise)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════ SECTION 4: PROCUREMENT INVOICES ════════ */}
      <div className="admin-card" style={{ marginBottom: 22 }}>
        <h3 style={{ marginBottom: 4 }}>Procurement Invoices</h3>
        <p
          style={{
            fontSize: 12,
            color: "var(--sage)",
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          Goods purchased from vendors — every &ldquo;Stock purchase&rdquo;
          expense recorded in the system.
        </p>

        {procurementRows.length > 0 ? (
          <>
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Vendor</th>
                    <th>Reference</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {procurementRows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {readableDate(r.spentOn)}
                      </td>
                      <td>{r.description}</td>
                      <td>{r.payee ?? "—"}</td>
                      <td style={{ color: "var(--sage)" }}>
                        {r.reference ? (
                          <code style={{ fontSize: 11.5 }}>{r.reference}</code>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 600,
                          fontFamily: "var(--font-display)",
                          fontSize: 16,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatPaise(r.amountPaise)}
                      </td>
                    </tr>
                  ))}
                  <tr
                    style={{
                      borderTop: "2px solid var(--olive)",
                      fontWeight: 700,
                    }}
                  >
                    <td colSpan={4}>Total procurement</td>
                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--font-display)",
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      {formatPaise(totalProcurementPaise)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Reconciliation */}
            <div
              style={{
                marginTop: 22,
                padding: 18,
                borderRadius: 6,
                background: differencePaise === 0 ? "rgba(0,128,107,0.06)" : "var(--sand)",
                border: `1px solid ${differencePaise === 0 ? "rgba(0,128,107,0.15)" : "var(--line)"}`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  color: "var(--sage)",
                  marginBottom: 12,
                }}
              >
                Contribution-to-Procurement Reconciliation
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase" as const,
                      color: "var(--sage)",
                      marginBottom: 4,
                    }}
                  >
                    Contributions
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 22,
                      fontWeight: 700,
                      color: "#00806B",
                    }}
                  >
                    {formatPaise(totalCapitalPaise)}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--sage)",
                  }}
                >
                  =
                </div>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase" as const,
                      color: "var(--sage)",
                      marginBottom: 4,
                    }}
                  >
                    Procurement
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 22,
                      fontWeight: 700,
                      color: "var(--gold)",
                    }}
                  >
                    {formatPaise(totalProcurementPaise)}
                  </div>
                </div>
              </div>
              <div
                style={{
                  textAlign: "center",
                  padding: "10px 0",
                  borderTop: "1px dashed var(--line)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase" as const,
                    color: differencePaise === 0 ? "#00806B" : "var(--sage)",
                  }}
                >
                  Difference
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 28,
                    fontWeight: 700,
                    color: differencePaise === 0 ? "#00806B" : differencePaise > 0 ? "var(--olive)" : "#a5333a",
                  }}
                >
                  {differencePaise === 0
                    ? "₹0"
                    : formatPaise(Math.abs(differencePaise))}
                </div>
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--sage)",
                  textAlign: "center",
                  marginTop: 8,
                  marginBottom: 0,
                  lineHeight: 1.45,
                }}
              >
                This is an arithmetic reconciliation of the recorded totals. It
                does not independently verify that every invoice has been paid.
              </p>
            </div>
          </>
        ) : (
          <p style={{ color: "var(--sage)" }}>
            No stock purchase expenses recorded yet.{" "}
            <Link
              href="/admin/money/expenses"
              style={{ color: "var(--gold)", textDecoration: "underline" }}
            >
              Record a spend →
            </Link>
          </p>
        )}
      </div>

      {/* ════════ SECTION 5: SALES COLLECTIONS ════════ */}
      <div
        className="admin-card"
        style={{
          marginBottom: 22,
          background: "rgba(58,110,165,0.04)",
          borderColor: "rgba(58,110,165,0.15)",
        }}
      >
        <h3 style={{ marginBottom: 4, color: "#3a6ea5" }}>Sales Collections</h3>
        <p
          style={{
            fontSize: 12,
            color: "var(--sage)",
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          Money earned from selling goods to customers. This is a separate
          financial flow — it is not mixed with partner contributions above.
        </p>

        {hasSales ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            <div
              style={{
                background: "rgba(58,110,165,0.07)",
                borderRadius: 6,
                padding: "14px 16px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  color: "#3a6ea5",
                  marginBottom: 4,
                }}
              >
                Total collections
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#3a6ea5",
                }}
              >
                {formatPaise(totalSalesPaise)}
              </div>
            </div>
            <div
              style={{
                background: "rgba(58,110,165,0.07)",
                borderRadius: 6,
                padding: "14px 16px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  color: "#3a6ea5",
                  marginBottom: 4,
                }}
              >
                Paid orders
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#3a6ea5",
                }}
              >
                {paidOrders.length}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "16px",
              borderRadius: 6,
              background: "var(--sand)",
              border: "1px dashed var(--line)",
              fontStyle: "italic",
              color: "var(--sage)",
            }}
          >
            No sales recorded yet — will appear here once orders come in
          </div>
        )}

        <p
          style={{
            fontSize: 11,
            color: "var(--sage)",
            marginTop: 14,
            marginBottom: 0,
            lineHeight: 1.45,
          }}
        >
          Sales collections are kept separate from partner contributions.
          They have not been reinvested into fresh procurement yet.
        </p>
      </div>

      {/* ════════ RECORD A CONTRIBUTION ════════ */}
      <div className="admin-card" style={{ marginBottom: 22 }}>
        <h3 style={{ marginBottom: 4 }}>Record a Contribution</h3>
        <p
          style={{
            fontSize: 12,
            color: "var(--sage)",
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          When either partner puts money into the business, record it here. The
          totals above update automatically.
        </p>
        <CapitalForm contributors={allContributors} />
      </div>

      {/* ════════ SUMMARY MESSAGE ════════ */}
      <div
        className="admin-card"
        style={{
          background: "rgba(0,128,107,0.05)",
          borderColor: "rgba(0,128,107,0.12)",
          marginBottom: 22,
        }}
      >
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          <strong>Summary: </strong>
          {people.map(([name], i) => (
            <span key={name}>
              {i > 0 && " and "}
              {name}
            </span>
          ))}{" "}
          contributed a combined{" "}
          <strong>{formatPaise(totalCapitalPaise)}</strong> to Urvi Studios. The
          recorded procurement invoices total{" "}
          <strong>{formatPaise(totalProcurementPaise)}</strong>, giving a
          difference of{" "}
          <strong>
            {differencePaise === 0
              ? "₹0"
              : formatPaise(Math.abs(differencePaise))}
          </strong>
          .{" "}
          {hasSales
            ? `Customer sales collections of ${formatPaise(totalSalesPaise)} are held separately in the bank account.`
            : "Customer sales collections will appear here once orders are recorded."}
        </p>
      </div>

      <p
        style={{
          fontSize: 11,
          color: "var(--sage)",
          textAlign: "center",
          padding: "6px 0 20px",
          lineHeight: 1.5,
        }}
      >
        Money Overview · All figures from the database · Updates in real time
      </p>
    </>
  );
}
