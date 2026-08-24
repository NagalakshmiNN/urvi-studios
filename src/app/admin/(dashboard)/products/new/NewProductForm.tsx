"use client";

import { useActionState, useRef, useEffect } from "react";
import { createProductAction } from "@/app/actions/admin";

export default function NewProductForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createProductAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form action={formAction} ref={formRef}>
      {state?.error && <div className="notice-box error">{state.error}</div>}
      {state?.success && <div className="notice-box">{state.success}</div>}

      <div className="form-group">
        <label>Product name</label>
        <input type="text" name="name" required />
      </div>
      <div className="form-group">
        <label>Category</label>
        <select name="categoryId" required defaultValue="">
          <option value="" disabled>Choose a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea name="description" rows={3} required />
      </div>
      <div className="form-group">
        <label>Fabric</label>
        <input type="text" name="fabric" placeholder="e.g. Pure silk with zari border" />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Price (₹)</label>
          <input type="number" name="price" required min={1} />
        </div>
        <div className="form-group">
          <label>Compare-at price (₹, optional)</label>
          <input type="number" name="compareAtPrice" min={1} />
        </div>
        <div className="form-group">
          <label>Stock</label>
          <input type="number" name="stock" defaultValue={10} min={0} />
        </div>
      </div>
      <div className="form-group">
        <label>Badge (optional)</label>
        <input type="text" name="badge" placeholder="e.g. New In, Bestseller" />
      </div>
      <div className="form-group">
        <label>Image URLs (one per line)</label>
        <textarea name="images" rows={3} required placeholder={"https://…/front.jpg\nhttps://…/back.jpg"} />
        <p className="field-hint">Send us the photos over WhatsApp or email and we&apos;ll host them — paste the links here once ready.</p>
      </div>
      <div className="form-group">
        <label>Sizes (comma separated)</label>
        <input type="text" name="sizes" required placeholder="S, M, L, XL" />
      </div>
      <div className="form-group">
        <label>Colors (optional, Name:#hex, comma separated)</label>
        <input type="text" name="colors" placeholder="Maroon:#7a2b2b, Gold:#A98238" />
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Adding…" : "Add Product"}
      </button>
    </form>
  );
}
