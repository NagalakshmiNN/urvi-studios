"use client";

import { useActionState, useState, useMemo } from "react";
import { updateProductFullAction } from "@/app/actions/admin";
import ImageUploader from "@/components/ImageUploader";
import SizeStockEditor from "@/components/SizeStockEditor";
import RichTextEditor from "@/components/RichTextEditor";

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  fabric: string;
  stylingTips: string | null;
  price: number;
  compareAtPrice: number | null;
  landedCost: number | null;
  minRoundUpTo: number | null;
  maxRoundUpTo: number | null;
  targetMarkupPct: number | null;
  minMarkupPct: number | null;
  badge: string | null;
  stock: number;
  isActive: boolean;
  categoryId: string;
  images: { url: string }[];
  sizes: { label: string; stock: number }[];
  colors: { name: string; hex: string }[];
};

type BandInfo = { targetPct: number; minPct: number; label: string };

function roundUpTo10(rupees: number): number {
  return Math.ceil(rupees / 10) * 10;
}

export default function EditProductForm({
  product,
  categories,
  bandInfo,
}: {
  product: Product;
  categories: { id: string; name: string }[];
  bandInfo: BandInfo | null;
}) {
  const [state, formAction, pending] = useActionState(updateProductFullAction, undefined);

  // Local state for markup % fields so the preview updates live
  const [targetPctInput, setTargetPctInput] = useState(
    product.targetMarkupPct != null ? String(product.targetMarkupPct) : ""
  );
  const [minPctInput, setMinPctInput] = useState(
    product.minMarkupPct != null ? String(product.minMarkupPct) : ""
  );

  // Compute preview prices from the markup inputs
  const preview = useMemo(() => {
    if (product.landedCost == null || product.landedCost <= 0) return null;

    const effectiveTarget = targetPctInput.trim() !== ""
      ? parseInt(targetPctInput, 10)
      : bandInfo?.targetPct ?? null;
    const effectiveMin = minPctInput.trim() !== ""
      ? parseInt(minPctInput, 10)
      : bandInfo?.minPct ?? null;

    if (effectiveTarget == null || effectiveMin == null) return null;
    if (!Number.isFinite(effectiveTarget) || !Number.isFinite(effectiveMin)) return null;

    const price = roundUpTo10(product.landedCost * (1 + effectiveTarget / 100));
    const minPrice = roundUpTo10(product.landedCost * (1 + effectiveMin / 100));

    return {
      price,
      minPrice,
      priceChanged: price !== product.price,
      minChanged: minPrice !== (product.minRoundUpTo ?? 0),
    };
  }, [targetPctInput, minPctInput, product.landedCost, product.price, product.minRoundUpTo, bandInfo]);

  const hasCustomMarkup = targetPctInput.trim() !== "" || minPctInput.trim() !== "";

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
        <RichTextEditor name="description" defaultValue={product.description} />
      </div>
      <div className="form-group">
        <label>Fabric</label>
        <textarea name="fabric" rows={2} placeholder="e.g. Pure silk with zari border" defaultValue={product.fabric} />
      </div>
      <div className="form-group">
        <label>Ease / styling</label>
        <textarea name="stylingTips" rows={3} placeholder="e.g. Pair with statement jewelry" defaultValue={product.stylingTips ?? ""} />
      </div>

      {/* ---- Markup & pricing section ---- */}
      {product.landedCost != null && product.landedCost > 0 && bandInfo && (
        <fieldset style={{ border: "1px solid var(--border, #ddd)", borderRadius: 8, padding: "16px 20px 12px", marginBottom: 20 }}>
          <legend style={{ fontWeight: 600, fontSize: 14, padding: "0 6px" }}>Markup %</legend>
          <p className="field-hint" style={{ marginTop: 0, marginBottom: 14, lineHeight: 1.6 }}>
            The band for this product&apos;s landed cost (₹{product.landedCost.toLocaleString("en-IN")}) is{" "}
            <strong>{bandInfo.label}</strong>: target {bandInfo.targetPct}%, minimum {bandInfo.minPct}%.
            {" "}Set a custom percentage here to override the band for this product only.
            Leave blank to use the band default.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label>Target markup %</label>
              <input
                type="number"
                name="targetMarkupPct"
                min={0}
                max={1000}
                step={1}
                placeholder={`Band: ${bandInfo.targetPct}%`}
                value={targetPctInput}
                onChange={(e) => setTargetPctInput(e.target.value)}
                style={{ width: 140 }}
              />
            </div>
            <div className="form-group">
              <label>Minimum markup %</label>
              <input
                type="number"
                name="minMarkupPct"
                min={0}
                max={1000}
                step={1}
                placeholder={`Band: ${bandInfo.minPct}%`}
                value={minPctInput}
                onChange={(e) => setMinPctInput(e.target.value)}
                style={{ width: 140 }}
              />
            </div>
          </div>

          {preview && (
            <div style={{
              background: hasCustomMarkup ? "var(--cream, #fffcf0)" : "var(--sand, #f5f3ee)",
              borderRadius: 6,
              padding: "10px 14px",
              fontSize: 13.5,
              lineHeight: 1.7,
              marginTop: 4,
            }}>
              {hasCustomMarkup ? (
                <>
                  <strong>Preview with custom markup:</strong>{" "}
                  Price ₹{preview.price.toLocaleString("en-IN")}
                  {preview.priceChanged && (
                    <span style={{ color: preview.price > product.price ? "var(--green, #2a7a3a)" : "var(--rust, #b5451b)" }}>
                      {" "}(currently ₹{product.price.toLocaleString("en-IN")})
                    </span>
                  )}
                  {" · "}Floor ₹{preview.minPrice.toLocaleString("en-IN")}
                  {preview.minChanged && product.minRoundUpTo != null && (
                    <span style={{ color: "var(--sage)" }}>
                      {" "}(currently ₹{product.minRoundUpTo.toLocaleString("en-IN")})
                    </span>
                  )}
                </>
              ) : (
                <>
                  <strong>Band default:</strong>{" "}
                  Price ₹{preview.price.toLocaleString("en-IN")} · Floor ₹{preview.minPrice.toLocaleString("en-IN")}
                </>
              )}
            </div>
          )}
        </fieldset>
      )}

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
      <div className="form-row">
        <div className="form-group">
          <label>Landed cost (₹, GST + shipping)</label>
          <input type="number" name="landedCost" min={0} defaultValue={product.landedCost ?? ""} placeholder="Usually set via Excel import" />
        </div>
        <div className="form-group">
          <label>Min round up to (₹)</label>
          <input type="number" name="minRoundUpTo" min={0} defaultValue={product.minRoundUpTo ?? ""} />
        </div>
        <div className="form-group">
          <label>Max round up to (₹)</label>
          <input type="number" name="maxRoundUpTo" min={0} defaultValue={product.maxRoundUpTo ?? ""} />
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
