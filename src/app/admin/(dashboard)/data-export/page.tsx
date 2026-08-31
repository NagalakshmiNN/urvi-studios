import { db, schema } from "@/db";
import { sql } from "drizzle-orm";

// Plain <a> links straight to the export API routes, not client-side fetch —
// a normal navigation is what makes the browser treat the response as a
// file download (Content-Disposition: attachment) rather than something to
// display, and it works with nothing extra: no JS, no click handler, no
// blocked-popup risk on mobile Safari.
const EXPORTS = [
  {
    href: "/api/admin/export/customers",
    title: "Customer Accounts",
    description: "Everyone with a login on the site — name, email (their login), phone, and how many orders, addresses, and wishlist items they have. Passwords are stored as one-way hashes and are never included in any export.",
  },
  {
    href: "/api/admin/export/orders",
    title: "Orders",
    description: "Every order placed — customer name, email, phone, delivery address, items, and pricing. This is the fullest record of customer contact and address details, since guest checkouts (no account) land here too.",
  },
  {
    href: "/api/admin/export/addresses",
    title: "Saved Addresses",
    description: "Addresses customers have saved to their account for faster checkout (their \"Address Book\"). Narrower than Orders — most orders come from guest checkout and never touch this list.",
  },
  {
    href: "/api/admin/export/wishlist",
    title: "Wishlist",
    description: "Which customer has which product saved to their wishlist, and when.",
  },
  {
    href: "/api/admin/export/reviews",
    title: "Reviews",
    description: "Every review submitted — reviewer name, rating, and text — across every product.",
  },
];

export default async function DataExportPage() {
  const [{ count: customerCount } = { count: 0 }] = await db.select({ count: sql<number>`count(*)` }).from(schema.customers);
  const [{ count: orderCount } = { count: 0 }] = await db.select({ count: sql<number>`count(*)` }).from(schema.orders);
  const [{ count: addressCount } = { count: 0 }] = await db.select({ count: sql<number>`count(*)` }).from(schema.addresses);
  const [{ count: wishlistCount } = { count: 0 }] = await db.select({ count: sql<number>`count(*)` }).from(schema.wishlistItems);
  const [{ count: reviewCount } = { count: 0 }] = await db.select({ count: sql<number>`count(*)` }).from(schema.reviews);
  const counts: Record<string, number> = {
    "/api/admin/export/customers": customerCount,
    "/api/admin/export/orders": orderCount,
    "/api/admin/export/addresses": addressCount,
    "/api/admin/export/wishlist": wishlistCount,
    "/api/admin/export/reviews": reviewCount,
  };

  return (
    <>
      <div className="admin-header">
        <h1>Data Export</h1>
      </div>

      <p style={{ fontSize: 13.5, color: "var(--sage)", maxWidth: 640, marginBottom: 28, lineHeight: 1.6 }}>
        Download a spreadsheet-ready CSV of everything in each category below, current as of right now. Each file
        opens directly in Excel or Google Sheets. This contains real customer personal information — names, phone
        numbers, emails, and home addresses — so treat downloaded copies the way you&apos;d treat any file with
        customer data: don&apos;t forward or store them somewhere less secure than the site itself.
      </p>

      <div className="export-grid">
        {EXPORTS.map((item) => (
          <div className="admin-card" key={item.href}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <h3 style={{ marginBottom: 6 }}>{item.title}</h3>
              <span style={{ fontSize: 11, letterSpacing: 0.5, color: "var(--sage)", whiteSpace: "nowrap" }}>
                {counts[item.href]} record{counts[item.href] === 1 ? "" : "s"}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "var(--earth)", lineHeight: 1.6, marginBottom: 18 }}>{item.description}</p>
            <a href={item.href} className="btn btn-outline btn-small" download>Download CSV</a>
          </div>
        ))}
      </div>
    </>
  );
}
