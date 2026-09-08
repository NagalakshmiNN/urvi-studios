import { db } from "@/db";
import { formatINR } from "@/lib/format";
import Link from "next/link";

// Everyone who has ever bought, grouped by phone number — the one detail
// that stays the same whether they ordered on the website or walked in and
// paid cash. Deliberately built from orders rather than website accounts,
// since someone who comes to the door may never create a login at all.
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show = "all" } = await searchParams;

  const orders = await db.query.orders.findMany({ orderBy: (o, { desc }) => [desc(o.createdAt)] });

  type Customer = {
    phone: string;
    name: string;
    email: string;
    orders: number;
    inPerson: number;
    website: number;
    spend: number;
    last: Date;
    first: Date;
  };

  const byPhone = new Map<string, Customer>();
  for (const o of orders) {
    // Compare on digits only: "98765 00001" and "9876500001" are one person.
    const key = o.customerPhone.replace(/\D/g, "");
    if (!key) continue;
    const existing = byPhone.get(key);
    const isInPerson = o.source === "walk_in";
    if (!existing) {
      byPhone.set(key, {
        phone: o.customerPhone,
        name: o.customerName,
        email: o.customerEmail,
        orders: 1,
        inPerson: isInPerson ? 1 : 0,
        website: o.source === "online" ? 1 : 0,
        spend: o.total,
        last: o.createdAt,
        first: o.createdAt,
      });
    } else {
      existing.orders++;
      if (isInPerson) existing.inPerson++;
      if (o.source === "online") existing.website++;
      existing.spend += o.total;
      // Orders arrive newest first, so anything later is older.
      if (o.createdAt < existing.first) existing.first = o.createdAt;
      if (!existing.email && o.customerEmail) existing.email = o.customerEmail;
    }
  }

  const all = [...byPhone.values()].sort((a, b) => b.spend - a.spend);
  const repeat = all.filter((c) => c.orders > 1);
  const walkIn = all.filter((c) => c.inPerson > 0);

  const customers = show === "repeat" ? repeat : show === "walk_in" ? walkIn : all;

  const FILTERS = [
    { value: "all", label: `Everyone (${all.length})` },
    { value: "repeat", label: `Bought more than once (${repeat.length})` },
    { value: "walk_in", label: `Came here in person (${walkIn.length})` },
  ];

  const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <div className="admin-header">
        <h1>Customers</h1>
      </div>

      <p style={{ fontSize: 13, color: "var(--sage)", marginBottom: 18 }}>
        Everyone who has bought from you, matched by phone number — so a customer who orders online and later
        collects in person shows up once, not twice. Click a phone number to see that person&apos;s full order
        history.
      </p>

      <div className="filter-bar" style={{ marginBottom: 20 }}>
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/admin/customers" : `/admin/customers?show=${f.value}`}
            className={`chip ${show === f.value ? "active" : ""}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Orders</th>
              <th>In person</th>
              <th>Website</th>
              <th>Total spend</th>
              <th>First bought</th>
              <th>Last bought</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.phone}>
                <td>
                  {c.name}
                  {c.email && <><br /><span style={{ color: "var(--sage)", fontSize: 11.5 }}>{c.email}</span></>}
                </td>
                <td>
                  <Link href={`/admin/orders?phone=${encodeURIComponent(c.phone)}`} style={{ color: "var(--olive)", fontWeight: 600 }}>
                    {c.phone}
                  </Link>
                </td>
                <td style={{ fontWeight: 600 }}>{c.orders}</td>
                <td>{c.inPerson || "—"}</td>
                <td>{c.website || "—"}</td>
                <td>{formatINR(c.spend)}</td>
                <td style={{ fontSize: 12.5 }}>{fmtDate(c.first)}</td>
                <td style={{ fontSize: 12.5 }}>{fmtDate(c.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <p style={{ padding: 20, color: "var(--sage)" }}>No customers here yet.</p>
        )}
      </div>
    </>
  );
}
