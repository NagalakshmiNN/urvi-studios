"use client";

import { useActionState, useId, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { updateProductAction } from "@/app/actions/admin";
import Link from "next/link";
import DeleteProductButton from "./DeleteProductButton";

type Product = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  landedCost: number | null;
  minRoundUpTo: number | null;
  maxRoundUpTo: number | null;
  badge: string | null;
  stock: number;
  isActive: boolean;
  category: { name: string };
  images: { url: string }[];
};

// Shows a costing value with its markup over Landed Cost tucked into the
// top-right corner, e.g. ₹850 with a small "+70%" badge — an at-a-glance
// margin check without needing to do the math against the Landed Cost
// column every time. Only renders the badge when both numbers are known
// and Landed Cost is actually positive (division-by-zero guard).
function MarkupValue({ value, landedCost }: { value: number | null; landedCost: number | null }) {
  if (value == null) return <span style={{ color: "var(--sage)" }}>—</span>;
  const pct = landedCost && landedCost > 0 ? Math.round(((value - landedCost) / landedCost) * 100) : null;
  return (
    <div style={{ position: "relative", display: "inline-block", paddingTop: pct != null ? 12 : 0 }}>
      {pct != null && (
        <span
          style={{
            position: "absolute",
            top: -2,
            right: -4,
            fontSize: 9.5,
            fontWeight: 700,
            color: pct >= 0 ? "var(--olive)" : "#a5333a",
            background: "var(--sand)",
            borderRadius: 3,
            padding: "0 3px",
            lineHeight: "13px",
          }}
        >
          {pct >= 0 ? "+" : ""}{pct}%
        </span>
      )}
      <span style={{ color: "var(--sage)" }}>₹{value.toLocaleString("en-IN")}</span>
    </div>
  );
}

export default function ProductRow({ product }: { product: Product }) {
  const [state, formAction, pending] = useActionState(updateProductAction, undefined);
  const formId = `product-form-${useId()}`;
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <>
      {/* A <form> can't legally live inside <tbody>/<tr>, so it's portaled to
          <body> once mounted and every control below points at it via the
          `form` attribute — same submit, valid table markup. */}
      {mounted &&
        createPortal(
          <form id={formId} action={formAction} style={{ display: "none" }}>
            <input type="hidden" name="productId" value={product.id} />
          </form>,
          document.body
        )}
      <tr>
        <td>
          <img src={product.images[0]?.url} alt="" style={{ width: 42, height: 52, objectFit: "cover", borderRadius: 2 }} />
        </td>
        <td><code style={{ fontSize: 12 }}>{product.sku}</code></td>
        <td>
          <Link href={`/product/${product.slug}`} target="_blank" style={{ color: "var(--olive)", fontWeight: 600 }}>
            {product.name}
          </Link>
        </td>
        <td>{product.category.name}</td>
        <td>
          <input form={formId} type="number" name="price" defaultValue={product.price} style={{ width: 80 }} className="admin-inline-input" />
        </td>
        <td>
          <input form={formId} type="number" name="compareAtPrice" defaultValue={product.compareAtPrice ?? ""} style={{ width: 80 }} className="admin-inline-input" />
        </td>
        <td style={{ color: "var(--sage)" }}>{product.landedCost != null ? `₹${product.landedCost.toLocaleString("en-IN")}` : "—"}</td>
        <td><MarkupValue value={product.minRoundUpTo} landedCost={product.landedCost} /></td>
        <td><MarkupValue value={product.maxRoundUpTo} landedCost={product.landedCost} /></td>
        <td>
          <input form={formId} type="text" name="badge" defaultValue={product.badge ?? ""} style={{ width: 90 }} className="admin-inline-input" />
        </td>
        <td>
          <Link href={`/admin/products/${product.id}/edit`} title="Edit sizes to change stock" style={{ color: "var(--earth)" }}>
            {product.stock}
          </Link>
        </td>
        <td>
          <input form={formId} type="checkbox" name="isActive" defaultChecked={product.isActive} />
        </td>
        <td>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button form={formId} type="submit" className="link-btn" disabled={!mounted || pending}>{pending ? "Saving…" : "Save"}</button>
            <Link href={`/admin/products/${product.id}/edit`} className="link-btn">Edit</Link>
            <DeleteProductButton productId={product.id} productName={product.name} />
          </div>
          {state?.error && <div style={{ color: "#a5333a", fontSize: 11.5, marginTop: 4 }}>{state.error}</div>}
        </td>
      </tr>
    </>
  );
}
