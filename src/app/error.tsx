"use client";

import Link from "next/link";

/**
 * Page-level error boundary — catches errors in any page component while
 * keeping the root layout (header, footer, etc.) intact.
 *
 * This means if one page crashes (e.g. the homepage DB query fails), the user
 * sees a branded error page with navigation still working, NOT a blank screen.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px 20px",
        fontFamily:
          "'Cormorant Garamond', 'Georgia', serif",
      }}
    >
      <div style={{ maxWidth: 480 }}>
        <div
          style={{
            fontSize: 48,
            marginBottom: 16,
            color: "var(--gold, #A98238)",
          }}
        >
          ✦
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 500,
            marginBottom: 12,
            color: "var(--olive, #3F4827)",
          }}
        >
          Something went wrong
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "var(--earth, #51462F)",
            lineHeight: 1.6,
            marginBottom: 28,
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          We hit an unexpected issue loading this page. Please try again, or
          head back to the homepage.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => reset()}
            style={{
              padding: "12px 28px",
              background: "var(--gold, #A98238)",
              color: "var(--ivory, #F7F0E4)",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.5px",
            }}
          >
            Try Again
          </button>
          <Link
            href="/"
            style={{
              padding: "12px 28px",
              background: "transparent",
              color: "var(--olive, #3F4827)",
              border: "1.5px solid var(--olive, #3F4827)",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              letterSpacing: "0.5px",
            }}
          >
            Go Home
          </Link>
        </div>
        {error.digest && (
          <p
            style={{
              fontSize: 12,
              color: "#999",
              marginTop: 24,
              fontFamily: "monospace",
            }}
          >
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
