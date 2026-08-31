"use client";

import { useState, useTransition } from "react";
import { deleteProductAction } from "@/app/actions/admin";

export default function DeleteProductButton({ productId, productName }: { productId: string; productName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    if (!confirm(`Delete "${productName}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteProductAction(productId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <button type="button" className="link-btn danger" disabled={pending} onClick={handleClick}>
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <div style={{ color: "#a5333a", fontSize: 11.5, marginTop: 4, maxWidth: 160 }}>{error}</div>}
    </div>
  );
}
