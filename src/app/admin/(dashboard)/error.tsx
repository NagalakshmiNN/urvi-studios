"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Admin error boundary]", error);
  }, [error]);

  return (
    <div style={{ padding: 40, maxWidth: 600 }}>
      <h2 style={{ color: "#b43232", marginBottom: 12 }}>Something went wrong</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 16, color: "var(--sage, #6A7444)" }}>
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="btn"
        style={{
          background: "var(--olive, #3F4827)",
          color: "var(--ivory, #F7F0E4)",
          border: "none",
          padding: "10px 20px",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        Try again
      </button>
    </div>
  );
}
