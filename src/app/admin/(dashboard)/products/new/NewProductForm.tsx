"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { createProductAction } from "@/app/actions/admin";
import ImageUploader from "@/components/ImageUploader";
import SizeStockEditor from "@/components/SizeStockEditor";
import RichTextEditor from "@/components/RichTextEditor";

export default function NewProductForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createProductAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  // Bumped on every successful add so the rich Description editor (which
  // keeps its own internal state, outside the plain form fields the native
  // reset() below already clears) also clears back to empty for the next
  // product instead of silently keeping the last one's text.
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setResetKey((k) => k + 1);
    }
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
        <RichTextEditor key={resetKey} name="description" />
      </div>
      <div className="form-group">
        <label>Fabric</label>
        <textarea name="fabric" rows={2} placeholder="e.g. Pure silk with zari border" />
      </div>
      <div className="form-group">
        <label>Ease / styling</label>
        <textarea name="stylingTips" rows={3} placeholder="e.g. Pair with statement jewelry" />
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
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Landed cost (₹, GST + shipping)</label>
          <input type="number" name="landedCost" min={0} placeholder="Usually set via Excel import" />
        </div>
        <div className="form-group">
          <label>Min round up to (₹)</label>
          <input type="number" name="minRoundUpTo" min={0} />
        </div>
        <div className="form-group">
          <label>Max round up to (₹)</label>
          <input type="number" name="maxRoundUpTo" min={0} />
        </div>
      </div>
      <div className="form-group">
        <label>Badge (optional)</label>
        <input type="text" name="badge" placeholder="e.g. New In, Bestseller" />
      </div>
      <div className="form-group">
        <label>Photos</label>
        <ImageUploader name="images" />
      </div>
      <div className="form-group">
        <label>Sizes &amp; stock</label>
        <SizeStockEditor />
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
