import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import EditProductForm from "./EditProductForm";
import { loadBands } from "@/lib/markup-band-store";
import { bandFor, bandLabel } from "@/lib/markup-bands";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [product, categories, bands] = await Promise.all([
    db.query.products.findFirst({
      where: eq(schema.products.id, id),
      with: { images: true, sizes: { orderBy: (s, { asc }) => [asc(s.position)] }, colors: true },
    }),
    db.query.categories.findMany({ orderBy: (c, { asc }) => [asc(c.position)] }),
    loadBands(),
  ]);

  if (!product) notFound();

  // Tell the form which band this product falls in, so the preview can show
  // band defaults alongside custom overrides.
  let bandInfo: { targetPct: number; minPct: number; label: string } | null = null;
  if (product.landedCost != null && product.landedCost > 0) {
    const band = bandFor(product.landedCost * 100, bands);
    const idx = bands.indexOf(band);
    bandInfo = {
      targetPct: band.targetPct,
      minPct: band.minPct,
      label: bandLabel(band, idx, bands),
    };
  }

  return (
    <>
      <div className="admin-header">
        <h1>Edit Product</h1>
      </div>
      <div className="admin-card admin-form-card">
        <EditProductForm
          product={product}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          bandInfo={bandInfo}
        />
      </div>
    </>
  );
}
