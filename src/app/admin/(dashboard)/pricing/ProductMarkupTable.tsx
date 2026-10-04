"use client";

import { useActionState, useState, useMemo, useId } from "react";
import { updateProductMarkupAction, type PricingFormState } from "@/app/actions/purchases";
import { markupPercent } from "@/lib/markup";

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  price: number;
  landedCost: number | null;
  minRoundUpTo: number | null;
  maxRoundUpTo: number | null;
  targetMarkupPct: number | null;
  minMarkupPct: number | null;
  bandTargetPct: number;
  bandMinPct: number;
  bandLabel: string;
};

function roundUpTo10(r: number): number {
  return Math.ceil(r / 10) * 10;
}

function ProductMarkupRow({ product }: { product: ProductRow }) {
  const formId = `markup-${useId()}`;
  const [state, formAction, pending] = useActionState<PricingFormState, FormData>(updateProductMarkupAction, undefined);

  const [targetPct, setTargetPct] = useState(product.targetMarkupPct != null ? String(product.targetMarkupPct) : "");
  const [minPct, setMinPct] = useState(product.minMarkupPct != null ? String(product.minMarkupPct) : "");

  const hasOverride = targetPct.trim() !== "" || minPct.trim() !== "";

  const preview = useMemo(() => {
    if (product.landedCost == null || product.landedCost <= 0) return null;
    const effTarget = targetPct.trim() !== "" ? parseInt(targetPct, 10) : product.bandTargetPct;
    const effMin = minPct.trim() !== "" ? parseInt(minPct, 10) : product.bandMinPct;
    if (!Number.isFinite(effTarget) || !Number.isFinite(effMin)) return null;
    return {
      price: roundUpTo10(product.landedCost * (1 + effTarget / 100)),
      minPrice: roundUpTo10(product.landedCost * (1 + effMin / 100)),
    };
  }, [targetPct, minPct, product.landedCost, product.bandTargetPct, product.bandMinPct]);

  const currentPct = markupPercent(product.price, product.landedCost);
  const wouldChange = preview != null && preview.price !== product.price;

  return (
    <tr style={hasOverride ? { background: "var(--cream, #fffcf0)" } : undefined}>
      <td>
        <span style={{ fontWeight: 500 }}>{product.name}</span>
        <br />
        <code style={{ fontSize: 11, color: "var(--sage)" }}>{product.sku}</code>
      </td>
      <td style={{ textAlign: "right" }}>
        {product.landedCost != null ? `₹${product.landedCost.toLocaleString("en-IN")}` : "—"}
      </td>
      <td style={{ textAlign: "right" }}>
        ₹{product.price.toLocaleString("en-IN")}
        {currentPct != null && (
          <span style={{ fontSize: 11, color: "var(--sage)", marginLeft: 4 }}>({currentPct}%)</span>
        )}
      </td>
      <td style={{ textAlign: "right" }}>
        <form id={formId} action={formAction} style={{ display: "none" }}>
          <input type="hidden" name="productId" value={product.id} />
        </form>
        <input
          form={formId}
          type="number"
          name="targetMarkupPct"
          min={0}
          max={1000}
          step={1}
          value={targetPct}
          onChange={(e) => setTargetPct(e.target.value)}
          placeholder={String(product.bandTargetPct)}
          className="admin-inline-input"
          style={{ width: 64, textAlign: "right" }}
        />
      </td>
      <td style={{ textAlign: "right" }}>
        <input
          form={formId}
          type="number"
          name="minMarkupPct"
          min={0}
          max={1000}
          step={1}
          value={minPct}
          onChange={(e) => setMinPct(e.target.value)}
          placeholder={String(product.bandMinPct)}
          className="admin-inline-input"
          style={{ width: 64, textAlign: "right" }}
        />
      </td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        {preview ? (
          <span style={wouldChange ? { fontWeight: 600 } : undefined}>
            ₹{preview.price.toLocaleString("en-IN")}
          </span>
        ) : "—"}
      </td>
      <td>
        <button form={formId} type="submit" className="link-btn" disabled={pending} style={{ fontSize: 12.5 }}>
          {pending ? "…" : "Save"}
        </button>
        {state?.error && <div style={{ color: "#a5333a", fontSize: 11, marginTop: 2 }}>{state.error}</div>}
        {state?.success && <div style={{ color: "var(--green, #2a7a3a)", fontSize: 11, marginTop: 2 }}>{state.success}</div>}
      </td>
    </tr>
  );
}

export default function ProductMarkupTable({ products }: { products: ProductRow[] }) {
  const [filter, setFilter] = useState<"all" | "overrides" | "no-cost">("all");

  const filtered = useMemo(() => {
    if (filter === "overrides") return products.filter((p) => p.targetMarkupPct != null || p.minMarkupPct != null);
    if (filter === "no-cost") return products.filter((p) => p.landedCost == null || p.landedCost <= 0);
    return products;
  }, [filter, products]);

  const overrideCount = products.filter((p) => p.targetMarkupPct != null || p.minMarkupPct != null).length;

  return (
    <div className="admin-card" style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Per-product markup</h3>
        {overrideCount > 0 && (
          <span style={{ fontSize: 13, color: "var(--sage)" }}>
            {overrideCount} product{overrideCount === 1 ? " has" : "s have"} custom markup
          </span>
        )}
      </div>

      <p style={{ fontSize: 13.5, color: "var(--sage)", lineHeight: 1.7, marginBottom: 14 }}>
        Set a custom markup on individual products when a band is too broad. Leave blank to keep the band default.
        Products with a custom markup are <strong>protected</strong> — "Apply to catalogue" will skip them and only re-price band-default products.
      </p>

      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        {(["all", "overrides", "no-cost"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`btn btn-sm${filter === v ? " btn-primary" : " btn-outline"}`}
            style={{ fontSize: 12.5, padding: "4px 10px" }}
          >
            {v === "all" ? `All (${products.length})` : v === "overrides" ? `Custom (${overrideCount})` : "No cost"}
          </button>
        ))}
      </div>

      <div className="table-scroll">
        <table className="admin-table" style={{ fontSize: 13.5 }}>
          <thead>
            <tr>
              <th>Product</th>
              <th style={{ textAlign: "right" }}>Landed</th>
              <th style={{ textAlign: "right" }}>Price now</th>
              <th style={{ textAlign: "right" }}>Target %</th>
              <th style={{ textAlign: "right" }}>Min %</th>
              <th style={{ textAlign: "right" }}>New price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <ProductMarkupRow key={p.id} product={p} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--sage)", padding: 24 }}>
                  {filter === "overrides" ? "No products have custom markup yet." : "No products without a landed cost."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
