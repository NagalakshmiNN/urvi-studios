"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cartCount, onCartChange } from "@/lib/cart";

export default function HeaderClient({ customerName }: { customerName: string | null }) {
  const [count, setCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setCount(cartCount());
    update();
    return onCartChange(update);
  }, []);

  useEffect(() => {
    const nav = document.getElementById("main-nav");
    if (!nav) return;
    nav.classList.toggle("open", menuOpen);
  }, [menuOpen]);

  return (
    <div className="header-actions">
      <Link href={customerName ? "/account" : "/account/login"} className="icon-btn desktop-only" aria-label="Account">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
        </svg>
      </Link>
      <Link href="/account/wishlist" className="icon-btn desktop-only" aria-label="Wishlist">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 21s-7.5-4.6-10-9.1C.5 8.4 2.3 5 5.9 5c2 0 3.4 1 4.1 2.3C10.7 6 12.1 5 14.1 5c3.6 0 5.4 3.4 3.9 6.9C19.5 16.4 12 21 12 21Z" />
        </svg>
      </Link>
      <Link href="/cart" className="icon-btn" aria-label="Cart">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        <span className="cart-count" style={{ display: count > 0 ? "flex" : "none" }}>{count}</span>
      </Link>
      <button className="menu-toggle" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <style jsx>{`
        .desktop-only { display: inline-flex; }
        @media (max-width: 680px) {
          .desktop-only { display: none; }
        }
      `}</style>
    </div>
  );
}
