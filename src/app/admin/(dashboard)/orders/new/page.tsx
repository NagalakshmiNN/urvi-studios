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
        <h1>Record an Order</h1>
      </div>
      <div className="admin-card admin-form-card" style={{ maxWidth: 760 }}>
        <p style={{ fontSize: 13, color: "var(--sage)", marginBottom: 20 }}>
          For a sale that came in over WhatsApp, a phone call, or in person — this logs it the same way a website
          checkout would: it counts toward revenue, shows up in Orders, and takes the stock out of the catalog.
        </p>
        <ManualOrderForm
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            stock: p.stock,
            sizes: p.sizes.map((s) => ({ label: s.label })),
            colors: p.colors.map((c) => ({ name: c.name })),
          }))}
        />
      </div>
    </>
  );
}
