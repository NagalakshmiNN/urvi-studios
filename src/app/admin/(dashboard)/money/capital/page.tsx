import { db, schema } from "@/db";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { formatPaise } from "@/lib/money";
import CapitalForm from "./CapitalForm";
import DeleteEntryButton from "../DeleteEntryButton";

function readableDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminCapitalPage() {
  const rows = await db.query.capitalContributions.findMany({
    orderBy: [desc(schema.capitalContributions.contributedOn), desc(schema.capitalContributions.createdAt)],
  });

  const total = rows.reduce((n, r) => n + r.amountPaise, 0);

  // Who has put in how much — the question a two-owner business asks most.
  const byPerson = new Map<string, number>();
  for (const r of rows) byPerson.set(r.contributor, (byPerson.get(r.contributor) ?? 0) + r.amountPaise);
  const people = [...byPerson.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="admin-header">
        <h1>Money In</h1>
        <Link href="/admin/money" className="btn btn-outline">See the Money Map</Link>
      </div>

      <p className="notice-box">
        Your own money put into the business — not sales. This is what the Money Map measures everything else
        against, so it&apos;s worth keeping complete.
      </p>

      <div className="metric-grid" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <div className="label">Total put in</div>
          <div className="value">{formatPaise(total)}</div>
        </div>
        {people.slice(0, 3).map(([name, paise]) => (
          <div className="metric-card" key={name}>
            <div className="label">{name}</div>
            <div className="value">{formatPaise(paise)}</div>
            <div className="metric-sub">{total > 0 ? `${Math.round((paise / total) * 100)}% of capital` : ""}</div>
          </div>
        ))}
      </div>

      <div className="admin-card" style={{ marginBottom: 28 }}>
        <h3 style={{ marginBottom: 16 }}>Record a contribution</h3>
        <CapitalForm contributors={people.map(([name]) => name)} />
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 14 }}>Everything so far</h3>
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr><th>Date</th><th>Who</th><th>Amount</th><th>How</th><th>Reference</th><th>Note</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{readableDate(r.contributedOn)}</td>
                  <td style={{ fontWeight: 600 }}>{r.contributor}</td>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{formatPaise(r.amountPaise)}</td>
                  <td>{r.mode}</td>
                  <td style={{ color: "var(--sage)" }}>{r.reference ?? "—"}</td>
                  <td style={{ color: "var(--sage)" }}>{r.notes ?? "—"}</td>
                  <td>
                    <DeleteEntryButton
                      id={r.id}
                      what={`${r.contributor} — ${formatPaise(r.amountPaise)}`}
                      kind="capital"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p style={{ padding: "20px 0 0", color: "var(--sage)" }}>
            Nothing recorded yet.
          </p>
        )}
      </div>
    </>
  );
}
