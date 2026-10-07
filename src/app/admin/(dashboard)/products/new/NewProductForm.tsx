"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { createProductAction } from "@/app/actions/admin";
import ImageUploader from "@/components/ImageUploader";
import SizeStockEditor from "@/components/SizeStockEditor";
import RichTextEditor from "@/components/RichTextEditor";

export default function NewProductForm({ categories }: { categories: { id: string; name: string; slug: string; parent: string | null }[] }) {
  const [state, formAction, pending] = useActionState(createProductAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  // Bumped on every successful add so the rich Description editor (which
  // keeps its own internal state, outside the plain form fields the native
  // reset() below already clears) also clears back to empty for the next
  // product instead of silently keeping the last one's text.
  const [resetKey, setResetKey] = useState(0);

  // ---- Category management state ----
  const [selectedParents, setSelectedParents] = useState<string[]>(["Everyday"]);
  const [browseParent, setBrowseParent] = useState("Everyday");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const subCategories = categories.filter(
    (c) => c.parent === browseParent && c.slug !== "2-piece-set" && c.slug !== "3-piece-set"
  );

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
      <input type="hidden" name="categoryId" value={selectedCategoryId} />
      <input type="hidden" name="parentTags" value={selectedParents.join("|")} />
      <div style={{
        border: "1px solid var(--sand, #d5cfc4)",
        borderRadius: 8,
        padding: "16px 18px",
        marginBottom: 16,
        background: "var(--ivory, #faf8f2)",
      }}>
        <label style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: "block", color: "var(--earth, #51462F)" }}>
          Category
        </label>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "var(--sage)", display: "block", marginBottom: 6 }}>Appears under (select all that apply)</span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["Everyday", "Office", "Occasion"].map((p) => {
              const checked = selectedParents.includes(p);
              return (
                <label
                  key={p}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 16px",
                    borderRadius: 6,
                    border: checked ? "2px solid var(--olive, #3F4827)" : "1px solid var(--sand, #d5cfc4)",
                    background: checked ? "var(--olive, #3F4827)" : "white",
                    color: checked ? "white" : "var(--earth, #51462F)",
                    fontWeight: checked ? 600 : 400,
                    fontSize: 13,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedParents((prev) => {
                        const next = prev.includes(p)
                          ? prev.filter((x) => x !== p)
                          : [...prev, p];
                        return next.length > 0 ? next : prev;
                      });
                    }}
                    style={{ width: "auto", accentColor: checked ? "white" : "var(--olive, #3F4827)" }}
                  />
                  {p}
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 12, color: "var(--sage)", display: "block", marginBottom: 6 }}>Primary sub-category</span>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {["Everyday", "Office", "Occasion"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setBrowseParent(p)}
                style={{
                  padding: "3px 10px",
                  borderRadius: 4,
                  border: "none",
                  background: browseParent === p ? "var(--sand, #EFE4D0)" : "transparent",
                  color: "var(--earth, #51462F)",
                  fontWeight: browseParent === p ? 600 : 400,
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {p}
              </button>
            ))}
          </div>
          {subCategories.length > 0 ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {subCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(c.id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 4,
                    border: selectedCategoryId === c.id ? "2px solid var(--gold, #A98238)" : "1px solid var(--sand, #d5cfc4)",
                    background: selectedCategoryId === c.id ? "var(--gold, #A98238)" : "white",
                    color: selectedCategoryId === c.id ? "white" : "var(--earth, #51462F)",
                    fontWeight: selectedCategoryId === c.id ? 600 : 400,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--sage)", fontSize: 12, margin: 0 }}>
              No sub-categories under {browseParent}.
            </p>
          )}
        </div>
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
