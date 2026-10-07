"use client";

import { useActionState, useState, useMemo } from "react";
import { updateProductFullAction, updateProductPriceAction } from "@/app/actions/admin";
import { updateProductMarkupAction, type PricingFormState } from "@/app/actions/purchases";
import ImageUploader from "@/components/ImageUploader";
import SizeStockEditor from "@/components/SizeStockEditor";
import RichTextEditor from "@/components/RichTextEditor";
import { FABRIC_TYPES } from "@/lib/fabric-types";

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
  parentTags: string | null;
  fabricTags: string | null;
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
  categories: { id: string; name: string; slug: string; parent: string | null }[];
  bandInfo: BandInfo | null;
}) {
  const [state, formAction, pending] = useActionState(updateProductFullAction, undefined);
  const [priceState, priceAction, pricePending] = useActionState(updateProductPriceAction, undefined);
  const [markupState, markupAction, markupPending] = useActionState<PricingFormState, FormData>(
    updateProductMarkupAction,
    undefined
  );

  const [targetPctInput, setTargetPctInput] = useState(
    product.targetMarkupPct != null ? String(product.targetMarkupPct) : ""
  );
  const [minPctInput, setMinPctInput] = useState(
    product.minMarkupPct != null ? String(product.minMarkupPct) : ""
  );

  // ---- Category management state ----
  const [selectedCategoryId, setSelectedCategoryId] = useState(product.categoryId);
  const currentCategory = categories.find((c) => c.id === selectedCategoryId);
  const currentParent = currentCategory?.parent || "Everyday";
  // parentTags: which parent sections this product appears in (multi-select)
  const initialParents = product.parentTags
    ? product.parentTags.split("|").filter(Boolean)
    : currentParent ? [currentParent] : ["Everyday"];
  const [selectedParents, setSelectedParents] = useState<string[]>(initialParents);
  // For sub-category browsing, show whichever parent is relevant
  const [browseParent, setBrowseParent] = useState(currentParent);
  const subCategories = categories.filter(
    (c) => c.parent === browseParent && c.slug !== "2-piece-set" && c.slug !== "3-piece-set"
  );

  // ---- Fabric tags state ----
  const initialFabrics = product.fabricTags
    ? product.fabricTags.split("|").filter(Boolean)
    : [];
  const [selectedFabrics, setSelectedFabrics] = useState<string[]>(initialFabrics);

  const preview = useMemo(() => {
    if (product.landedCost == null || product.landedCost <= 0) return null;

    const effectiveTarget =
      targetPctInput.trim() !== "" ? parseInt(targetPctInput, 10) : bandInfo?.targetPct ?? null;
    const effectiveMin =
      minPctInput.trim() !== "" ? parseInt(minPctInput, 10) : bandInfo?.minPct ?? null;

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
  const showMarkup = product.landedCost != null && product.landedCost > 0 && bandInfo != null;

  return (
    <>
      {/* ---- Main product details ---- */}
      <div className="admin-card admin-form-card">
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
          <input type="hidden" name="categoryId" value={selectedCategoryId} />
          <input type="hidden" name="parentTags" value={selectedParents.join("|")} />
          <input type="hidden" name="fabricTags" value={selectedFabrics.join("|")} />
          <div className="form-group">
            <label>Description</label>
            <RichTextEditor name="description" defaultValue={product.description} />
          </div>
          <div className="form-group">
            <label>Fabric</label>
            <textarea name="fabric" rows={2} placeholder="e.g. Pure silk with zari border" defaultValue={product.fabric} />
            <p className="field-hint">Descriptive text shown on the product page.</p>
          </div>
          <div className="form-group">
            <label>Fabric type (for filtering)</label>
            <p className="field-hint" style={{ marginTop: 0, marginBottom: 8 }}>
              Tick every fabric this product is made of. Customers filter by these on the shop page.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {FABRIC_TYPES.map((fab) => {
                const checked = selectedFabrics.includes(fab);
                return (
                  <label
                    key={fab}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 14px",
                      borderRadius: 4,
                      border: checked ? "2px solid var(--gold, #A98238)" : "1px solid var(--sand, #d5cfc4)",
                      background: checked ? "var(--gold, #A98238)" : "white",
                      color: checked ? "white" : "var(--earth, #51462F)",
                      fontWeight: checked ? 600 : 400,
                      fontSize: 13,
                      cursor: "pointer",
                      userSelect: "none" as const,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedFabrics((prev) =>
                          prev.includes(fab) ? prev.filter((x) => x !== fab) : [...prev, fab]
                        );
                      }}
                      style={{ width: "auto", accentColor: checked ? "white" : "var(--gold, #A98238)" }}
                    />
                    {fab}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="form-group">
            <label>Ease / styling</label>
            <textarea name="stylingTips" rows={3} placeholder="e.g. Pair with statement jewelry" defaultValue={product.stylingTips ?? ""} />
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
            <input type="text" name="colors" placeholder="Maroon:#7a2b2b, Gold:#A98238" defaultValue={product.colors.map((c) => `${c.name}:${c.hex}`).join(", ")} />
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
      </div>

      {/* ---- Category Management ---- */}
      <div className="admin-card" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>Category</h3>
        <p className="field-hint" style={{ marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
          Tick the sections this product should appear in on the shop page. A kurta that works
          for everyday and office wear? Tick both. Then pick the primary sub-category below.
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--earth, #51462F)" }}>
            Appears under (select all that apply)
          </label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {["Everyday", "Office", "Occasion"].map((p) => {
              const checked = selectedParents.includes(p);
              return (
                <label
                  key={p}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 18px",
                    borderRadius: 6,
                    border: checked ? "2px solid var(--olive, #3F4827)" : "1px solid var(--sand, #d5cfc4)",
                    background: checked ? "var(--olive, #3F4827)" : "white",
                    color: checked ? "white" : "var(--earth, #51462F)",
                    fontWeight: checked ? 600 : 400,
                    fontSize: 14,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
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
                        // Must have at least one parent selected
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

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--earth, #51462F)" }}>
            Primary sub-category
          </label>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {["Everyday", "Office", "Occasion"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setBrowseParent(p)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 4,
                  border: "none",
                  background: browseParent === p ? "var(--sand, #EFE4D0)" : "transparent",
                  color: "var(--earth, #51462F)",
                  fontWeight: browseParent === p ? 600 : 400,
                  fontSize: 12,
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
                    padding: "6px 16px",
                    borderRadius: 4,
                    border: selectedCategoryId === c.id ? "2px solid var(--gold, #A98238)" : "1px solid var(--sand, #d5cfc4)",
                    background: selectedCategoryId === c.id ? "var(--gold, #A98238)" : "white",
                    color: selectedCategoryId === c.id ? "white" : "var(--earth, #51462F)",
                    fontWeight: selectedCategoryId === c.id ? 600 : 400,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--sage)", fontSize: 13, margin: 0 }}>
              No sub-categories under {browseParent}.
            </p>
          )}
        </div>

        <div style={{
          padding: "8px 14px",
          background: "var(--sand, #f5f3ee)",
          borderRadius: 6,
          fontSize: 13,
          color: "var(--earth, #51462F)",
        }}>
          Appears in: <strong>{selectedParents.join(", ")}</strong>
          {currentCategory && (<> · Sub-category: <strong>{currentCategory.name}</strong></>)}
        </div>
      </div>

      {/* ---- Price & Markup side by side ---- */}
      <div style={{ display: "flex", gap: 24, marginTop: 24, alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* Price section */}
        <div className="admin-card" style={{ flex: "1 1 340px", minWidth: 300 }}>
          <form action={priceAction}>
            <input type="hidden" name="productId" value={product.id} />
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Price</h3>

            <div className="form-group">
              <label>Price (&#8377;)</label>
              <input type="number" name="price" required min={1} defaultValue={product.price} />
            </div>
            <div className="form-group">
              <label>Compare-at price (&#8377;, optional)</label>
              <input type="number" name="compareAtPrice" min={1} defaultValue={product.compareAtPrice ?? ""} />
            </div>
            <div className="form-group">
              <label>Landed cost (&#8377;, GST + shipping)</label>
              <input type="number" name="landedCost" min={0} defaultValue={product.landedCost ?? ""} placeholder="Usually set via import" />
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Min round up to (&#8377;)</label>
                <input type="number" name="minRoundUpTo" min={0} defaultValue={product.minRoundUpTo ?? ""} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Max round up to (&#8377;)</label>
                <input type="number" name="maxRoundUpTo" min={0} defaultValue={product.maxRoundUpTo ?? ""} />
              </div>
            </div>

            {priceState?.error && <div className="form-error">{priceState.error}</div>}
            {priceState?.success && <div className="form-success">{priceState.success}</div>}

            <button type="submit" className="btn btn-primary" disabled={pricePending} style={{ marginTop: 8 }}>
              {pricePending ? "Saving…" : "Save price"}
            </button>
          </form>
        </div>

        {/* Markup section */}
        {showMarkup && (
          <div className="admin-card" style={{ flex: "1 1 340px", minWidth: 300 }}>
            <form action={markupAction}>
              <input type="hidden" name="productId" value={product.id} />
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Markup %</h3>
              <p className="field-hint" style={{ marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
                Band for &#8377;{product.landedCost!.toLocaleString("en-IN")} landed cost is{" "}
                <strong>{bandInfo!.label}</strong>: target {bandInfo!.targetPct}%, min {bandInfo!.minPct}%.
                Override below for this product only. Leave blank for band default.
              </p>

              <div style={{ display: "flex", gap: 14 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Target markup %</label>
                  <input
                    type="number"
                    name="targetMarkupPct"
                    min={0} max={1000} step={1}
                    placeholder={`Band: ${bandInfo!.targetPct}%`}
                    value={targetPctInput}
                    onChange={(e) => setTargetPctInput(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Minimum markup %</label>
                  <input
                    type="number"
                    name="minMarkupPct"
                    min={0} max={1000} step={1}
                    placeholder={`Band: ${bandInfo!.minPct}%`}
                    value={minPctInput}
                    onChange={(e) => setMinPctInput(e.target.value)}
                  />
                </div>
              </div>

              {preview && (
                <div style={{
                  background: hasCustomMarkup ? "var(--cream, #fffcf0)" : "var(--sand, #f5f3ee)",
                  borderRadius: 6, padding: "10px 14px", fontSize: 13.5, lineHeight: 1.7, marginTop: 4,
                }}>
                  {hasCustomMarkup ? (
                    <>
                      <strong>Preview:</strong> Price &#8377;{preview.price.toLocaleString("en-IN")}
                      {preview.priceChanged && (
                        <span style={{ color: preview.price > product.price ? "var(--green, #2a7a3a)" : "var(--rust, #b5451b)" }}>
                          {" "}(currently &#8377;{product.price.toLocaleString("en-IN")})
                        </span>
                      )}
                      {" · "}Floor &#8377;{preview.minPrice.toLocaleString("en-IN")}
                      {preview.minChanged && product.minRoundUpTo != null && (
                        <span style={{ color: "var(--sage)" }}>
                          {" "}(currently &#8377;{product.minRoundUpTo.toLocaleString("en-IN")})
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <strong>Band default:</strong> Price &#8377;{preview.price.toLocaleString("en-IN")}
                      {" · "}Floor &#8377;{preview.minPrice.toLocaleString("en-IN")}
                    </>
                  )}
                </div>
              )}

              {markupState?.error && <div className="form-error" style={{ marginTop: 10 }}>{markupState.error}</div>}
              {markupState?.success && <div className="form-success" style={{ marginTop: 10 }}>{markupState.success}</div>}

              <button type="submit" className="btn btn-primary" disabled={markupPending} style={{ marginTop: 12 }}>
                {markupPending ? "Saving…" : "Save markup"}
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
