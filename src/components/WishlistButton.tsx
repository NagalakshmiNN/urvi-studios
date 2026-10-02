"use client";

import { useEffect, useState, useCallback } from "react";

/** Short, cheerful "pop" sound using the Web Audio API — no file needed. */
function playHeartSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    // Quick ascending chirp: 600 → 1200 Hz over 120 ms
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
    // Clean up
    osc.onended = () => { gain.disconnect(); ctx.close().catch(() => {}); };
  } catch {
    // No audio support — silent fallback
  }
}

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
  const [popping, setPopping] = useState(false);

  useEffect(() => setActive(initialActive), [initialActive]);

  const toggle = useCallback(async (e: React.MouseEvent) => {
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

    if (next) {
      playHeartSound();
      setPopping(true);
      setTimeout(() => setPopping(false), 400);
    }

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
  }, [active, busy, isLoggedIn, productId]);

  return (
    <button
      className={`wishlist-btn${active ? " active" : ""}${popping ? " pop" : ""}`}
      onClick={toggle}
      aria-pressed={active}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      style={size === "large" ? { position: "static", width: 44, height: 44, background: "#fff", border: "1px solid var(--line)" } : undefined}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "#3F4827" : "none"} stroke="#d44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
