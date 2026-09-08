import { db } from "@/db";
import ManualOrderForm from "./ManualOrderForm";

export default async function NewManualOrderPage() {
  const products = await db.query.products.findMany({
    where: (p, { eq }) => eq(p.isActive, true),
    with: { sizes: true, colors: true },
    orderBy: (p, { asc }) => [asc(p.name)],
  });

  return (
    <>
      <div className="admin-header">
        <h1>Record a Sale</h1>
      </div>
      <div className="admin-card admin-form-card" style={{ maxWidth: 760 }}>
        <p style={{ fontSize: 13, color: "var(--sage)", marginBottom: 20 }}>
          For someone who came here in person, or a sale that came in over WhatsApp or a phone call — this logs it
          the same way a website checkout would: it counts toward revenue, shows up in Orders, takes the stock out
          of the catalog, and builds up that customer&apos;s history under their phone number.
        </p>
        <ManualOrderForm
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            stock: p.stock,
            sizes: p.sizes.map((s) => ({ label: s.label, stock: s.stock })),
            colors: p.colors.map((c) => ({ name: c.name })),
          }))}
        />
      </div>
    </>
  );
}
