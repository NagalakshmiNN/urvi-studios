"use client";

import { useEffect, useState } from "react";

export default function WishlistButton({
  productId,
  isLoggedIn,
  initialActive = false,
  size = "normal",
}: {
  productId: string;
  isLoggedIn: boolean;
  initialActive?: boolean;
  size?: "normal" | "large";
}) {
  const [active, setActive] = useState(initialActive);
  const [busy, setBusy] = useState(false);

  useEffect(() => setActive(initialActive), [initialActive]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      window.location.href = `/account/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !active;
    setActive(next); // optimistic
    try {
      const res = await fetch("/api/wishlist", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) setActive(!next); // revert on failure
    } catch {
      setActive(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={`wishlist-btn ${active ? "active" : ""}`}
      onClick={toggle}
      aria-pressed={active}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      style={size === "large" ? { position: "static", width: 44, height: 44, background: "#fff", border: "1px solid var(--line)" } : undefined}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
        <path d="M12 21s-7.5-4.6-10-9.1C.5 8.4 2.3 5 5.9 5c2 0 3.4 1 4.1 2.3C10.7 6 12.1 5 14.1 5c3.6 0 5.4 3.4 3.9 6.9C19.5 16.4 12 21 12 21Z" />
      </svg>
    </button>
  );
}
