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
  badge: string | null;
  stock: number;
  isActive: boolean;
  category: { name: string };
  images: { url: string }[];
};

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
        <td>
          <input form={formId} type="text" name="badge" defaultValue={product.badge ?? ""} style={{ width: 90 }} className="admin-inline-input" />
        </td>
        <td>
          <input form={formId} type="number" name="stock" defaultValue={product.stock} style={{ width: 60 }} className="admin-inline-input" />
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
