"use client";

import { useState } from "react";

/**
 * A small download-icon button that fetches the GST tax invoice PDF for an
 * order and triggers a browser download. Sits in the first column of the
 * admin orders table.
 */
export default function InvoiceDownloadButton({ orderNumber }: { orderNumber: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/invoice/${encodeURIComponent(orderNumber)}`);
      if (!res.ok) {
        alert("Could not generate invoice. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={`Download invoice for ${orderNumber}`}
      style={{
        background: "none",
        border: "1px solid var(--sage, #999)",
        borderRadius: 4,
        cursor: loading ? "wait" : "pointer",
        padding: "3px 6px",
        fontSize: 14,
        lineHeight: 1,
        color: "var(--olive, #4F4B39)",
        opacity: loading ? 0.5 : 1,
      }}
    >
      {loading ? "..." : "📄"}
    </button>
  );
}
