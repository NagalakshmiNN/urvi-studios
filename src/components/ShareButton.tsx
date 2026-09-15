"use client";

// Sharing a piece with a friend — the way most of this shop's customers
// actually shop. WhatsApp is named first because that is where it goes.
//
// On a phone, the device's own share sheet is better than anything we could
// build: it already has WhatsApp, Instagram, Telegram, Messages and whatever
// else that person uses, in their own order. So we hand off to it when it
// exists, and only fall back to our own small menu (desktop browsers, mostly)
// when it doesn't.
//
// navigator.share is checked inside the click handler rather than during
// render. Checking it while rendering would give a different answer on the
// server than in the browser, and React would complain about the mismatch.

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Absolute URL — this gets pasted into other people's apps. */
  url: string;
  title: string;
  /** Formatted price, e.g. "₹1,940". Optional: cards pass it, the PDP doesn't. */
  price?: string;
  /** "large" is the product page; the default suits a product card. */
  size?: "small" | "large";
};

function shareMessage(title: string, price?: string) {
  return price ? `${title} — ${price} · URVI Studios` : `${title} · URVI Studios`;
}

export default function ShareButton({ url, title, price, size = "small" }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click-away and Escape, so the menu never gets stranded open.
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const text = shareMessage(title, price);
  const encodedText = encodeURIComponent(`${text}\n${url}`);
  const encodedUrl = encodeURIComponent(url);

  const links = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodedText}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(text)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodeURIComponent(text)}` },
    { label: "Email", href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}` },
  ];

  async function handleShare() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // Cancelling the sheet rejects, and so does a browser that refuses the
        // payload. Neither is worth interrupting someone over, and opening our
        // own menu on top of a sheet they just dismissed would be worse.
      }
      return;
    }
    setMenuOpen((open) => !open);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused outright; the links above still work.
      setCopied(false);
    }
  }

  return (
    <div className={`share-wrap ${size === "large" ? "share-large" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className="share-btn"
        onClick={handleShare}
        aria-label={`Share ${title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title="Share with a friend"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 10.6l6.8-4M8.6 13.4l6.8 4" />
        </svg>
        {size === "large" && <span>Share</span>}
      </button>

      {menuOpen && (
        <div className="share-menu" role="menu">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <button type="button" role="menuitem" onClick={copyLink}>
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}
