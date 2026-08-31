"use client";

import { useState, useTransition } from "react";
import { deleteProductAction } from "@/app/actions/admin";

// Two separate confirmations before anything is actually deleted: an inline
// "are you sure" step right in the row, then a native browser dialog as a
// second, harder-to-fat-finger gate. Either one can be backed out of.
export default function DeleteProductButton({ productId, productName }: { productId: string; productName: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFirstClick() {
    setError(null);
    setConfirming(true);
  }

  function handleFinalConfirm() {
    if (!confirm(`Last check — permanently delete "${productName}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteProductAction(productId);
      if (result?.error) setError(result.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11.5, color: "#a5333a", fontWeight: 600 }}>Delete this product?</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="link-btn danger" disabled={pending} onClick={handleFinalConfirm}>
            {pending ? "Deleting…" : "Yes, delete"}
          </button>
          <button type="button" className="link-btn" disabled={pending} onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
        {error && <div style={{ color: "#a5333a", fontSize: 11.5, marginTop: 2, maxWidth: 160 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="link-btn danger" onClick={handleFirstClick}>
        Delete
      </button>
      {error && <div style={{ color: "#a5333a", fontSize: 11.5, marginTop: 4, maxWidth: 160 }}>{error}</div>}
    </div>
  );
}
