import { db } from "@/db";
import NewProductForm from "./NewProductForm";

export default async function NewProductPage() {
  const categories = await db.query.categories.findMany({ orderBy: (c, { asc }) => [asc(c.position)] });

  return (
    <>
      <div className="admin-header">
        <h1>Add Product</h1>
      </div>
      <div className="admin-card admin-form-card">
        <NewProductForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
    </>
  );
}
