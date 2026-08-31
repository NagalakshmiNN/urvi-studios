"use client";

import { useActionState } from "react";
import { updateProductFullAction } from "@/app/actions/admin";

type Product = {
  id: string;
  name: string;
  description: string;
  fabric: string;
  price: number;
  compareAtPrice: number | null;
  badge: string | null;
  stock: number;
  isActive: boolean;
  categoryId: string;
  images: { url: string }[];
  sizes: { label: string }[];
  colors: { name: string; hex: string }[];
};

export default function EditProductForm({ product, categories }: { product: Product; categories: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(updateProductFullAction, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="productId" value={product.id} />
      {state?.error && <div className="notice-box error">{state.error}</div>}
      {state?.success && <div className="notice-box">{state.success}</div>}

      <div className="form-group">
        <label>Product name</label>
        <input type="text" name="name" required defaultValue={product.name} />
      </div>
      <div className="form-group">
        <label>Category</label>
        <select name="categoryId" required defaultValue={product.categoryId}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea name="description" rows={3} required defaultValue={product.description} />
      </div>
      <div className="form-group">
        <label>Fabric</label>
        <input type="text" name="fabric" placeholder="e.g. Pure silk with zari border" defaultValue={product.fabric} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Price (₹)</label>
          <input type="number" name="price" required min={1} defaultValue={product.price} />
        </div>
        <div className="form-group">
          <label>Compare-at price (₹, optional)</label>
          <input type="number" name="compareAtPrice" min={1} defaultValue={product.compareAtPrice ?? ""} />
        </div>
        <div className="form-group">
          <label>Stock</label>
          <input type="number" name="stock" min={0} defaultValue={product.stock} />
        </div>
      </div>
      <div className="form-group">
        <label>Badge (optional)</label>
        <input type="text" name="badge" placeholder="e.g. New In, Bestseller" defaultValue={product.badge ?? ""} />
      </div>
      <div className="form-group">
        <label>Image URLs (one per line)</label>
        <textarea
          name="images"
          rows={3}
          required
          placeholder={"https://…/front.jpg\nhttps://…/back.jpg"}
          defaultValue={product.images.map((i) => i.url).join("\n")}
        />
        <p className="field-hint">Send us the photos over WhatsApp or email and we&apos;ll host them — paste the links here once ready.</p>
      </div>
      <div className="form-group">
        <label>Sizes (comma separated)</label>
        <input type="text" name="sizes" required placeholder="S, M, L, XL" defaultValue={product.sizes.map((s) => s.label).join(", ")} />
      </div>
      <div className="form-group">
        <label>Colors (optional, Name:#hex, comma separated)</label>
        <input
          type="text"
          name="colors"
          placeholder="Maroon:#7a2b2b, Gold:#A98238"
          defaultValue={product.colors.map((c) => `${c.name}:${c.hex}`).join(", ")}
        />
      </div>
      <div className="form-group">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" name="isActive" defaultChecked={product.isActive} style={{ width: "auto" }} />
          Active (visible in the shop)
        </label>
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
