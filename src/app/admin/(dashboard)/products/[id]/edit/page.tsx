import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import EditProductForm from "./EditProductForm";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    db.query.products.findFirst({
      where: eq(schema.products.id, id),
      with: { images: true, sizes: true, colors: true },
    }),
    db.query.categories.findMany({ orderBy: (c, { asc }) => [asc(c.position)] }),
  ]);

  if (!product) notFound();

  return (
    <>
      <div className="admin-header">
        <h1>Edit Product</h1>
      </div>
      <div className="admin-card admin-form-card">
        <EditProductForm product={product} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
    </>
  );
}
