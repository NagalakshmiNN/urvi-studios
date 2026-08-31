"use client";

import { useActionState } from "react";
import { updateProductFullAction } from "@/app/actions/admin";
import ImageUploader from "@/components/ImageUploader";
import SizeStockEditor from "@/components/SizeStockEditor";

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  fabric: string;
  perfectFor: string | null;
  bestWeather: string | null;
  stylingTips: string | null;
  styleNotes: string | null;
  price: number;
  compareAtPrice: number | null;
  badge: string | null;
  stock: number;
  isActive: boolean;
  categoryId: string;
  images: { url: string }[];
  sizes: { label: string; stock: number }[];
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
        <label>Product ID</label>
        <input type="text" value={product.sku} readOnly disabled style={{ background: "var(--sand)", fontFamily: "monospace" }} />
        <p className="field-hint">This product&apos;s single identifier everywhere — the site, orders, and the Excel export/import. Doesn&apos;t change.</p>
      </div>
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
          <label>Perfect for / where to wear</label>
          <input type="text" name="perfectFor" placeholder="e.g. Weddings, festive evenings" defaultValue={product.perfectFor ?? ""} />
        </div>
        <div className="form-group">
          <label>Best weather</label>
          <input type="text" name="bestWeather" placeholder="e.g. Cool, breezy evenings" defaultValue={product.bestWeather ?? ""} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Ease / styling</label>
          <input type="text" name="stylingTips" placeholder="e.g. Pair with statement jewelry" defaultValue={product.stylingTips ?? ""} />
        </div>
        <div className="form-group">
          <label>Style</label>
          <input type="text" name="styleNotes" placeholder="e.g. Regal, flowing silhouette" defaultValue={product.styleNotes ?? ""} />
        </div>
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
      </div>
      <div className="form-group">
        <label>Badge (optional)</label>
        <input type="text" name="badge" placeholder="e.g. New In, Bestseller" defaultValue={product.badge ?? ""} />
      </div>
      <div className="form-group">
        <label>Photos</label>
        <ImageUploader name="images" defaultUrls={product.images.map((i) => i.url)} />
      </div>
      <div className="form-group">
        <label>Sizes &amp; stock</label>
        <SizeStockEditor initialSizes={product.sizes.map((s) => ({ label: s.label, stock: s.stock }))} />
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
