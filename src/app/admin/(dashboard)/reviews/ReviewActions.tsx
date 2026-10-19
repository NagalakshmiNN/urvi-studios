"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewActions({ reviewId, currentStatus }: { reviewId: string; currentStatus: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function setStatus(status: "APPROVED" | "REJECTED") {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, status }),
      });
      if (res.ok) router.refresh();
      else alert("Failed to update review.");
    } finally {
      setLoading(false);
    }
  }

  if (currentStatus !== "PENDING") {
    return (
      <span style={{
        fontSize: 12,
        padding: "3px 10px",
        borderRadius: 12,
        background: currentStatus === "APPROVED" ? "rgba(76,140,60,0.12)" : "rgba(200,60,60,0.12)",
        color: currentStatus === "APPROVED" ? "#4c8c3c" : "#c83c3c",
        fontWeight: 600,
      }}>
        {currentStatus}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={() => setStatus("APPROVED")}
        disabled={loading}
        style={{
          padding: "5px 14px",
          fontSize: 12.5,
          borderRadius: 6,
          border: "none",
          background: "#4c8c3c",
          color: "#fff",
          cursor: loading ? "wait" : "pointer",
          fontWeight: 600,
        }}
      >
        Approve
      </button>
      <button
        onClick={() => setStatus("REJECTED")}
        disabled={loading}
        style={{
          padding: "5px 14px",
          fontSize: 12.5,
          borderRadius: 6,
          border: "1px solid #c83c3c",
          background: "transparent",
          color: "#c83c3c",
          cursor: loading ? "wait" : "pointer",
          fontWeight: 600,
        }}
      >
        Reject
      </button>
    </div>
  );
}
