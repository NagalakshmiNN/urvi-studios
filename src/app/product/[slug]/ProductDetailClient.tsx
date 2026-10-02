"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatINR } from "@/lib/format";
import { addToCart } from "@/lib/cart";
import { toDisplayHtml } from "@/lib/richtext";
import WishlistButton from "@/components/WishlistButton";
import ShareButton from "@/components/ShareButton";
import SizeGuide from "@/components/SizeGuide";
import { SITE } from "@/lib/site-config";

type Product = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  fabric: string;
  perfectFor: string | null;
  bestWeather: string | null;
  stylingTips: string | null;
  styleNotes: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  images: { url: string }[];
  sizes: { label: string; stock: number }[];
  colors: { name: string; hex: string }[];
  category: { name: string };
};

export default function ProductDetailClient({
  product,
  isLoggedIn,
  wishlisted,
}: {
  product: Product;
  isLoggedIn: boolean;
  wishlisted: boolean;
}) {
  const router = useRouter();
  const [size, setSize] = useState(
    () => product.sizes.find((s) => s.stock > 0)?.label ?? product.sizes[0]?.label ?? ""
  );
  const [color, setColor] = useState(product.colors[0]?.name ?? "");
  const [qty, setQty] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  // All the photos uploaded for this product were always stored — the page
  // just never showed more than the first one. Clicking a thumbnail swaps
  // which one is the big main image; the thumbnail strip only renders when
  // there's more than one photo to choose from.
  const [activeImage, setActiveImage] = useState(0);
  const [todayViews, setTodayViews] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  // Read-aloud: use the browser's SpeechSynthesis API
  function toggleReadAloud() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    // Build the text to read: name, price, description, fabric, style notes
    const descText = product.description.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
    const parts = [
      product.name,
      `Priced at ${Math.round(product.price)} rupees.`,
      descText,
      product.fabric ? `Fabric: ${product.fabric}.` : "",
      product.perfectFor ? `Perfect for: ${product.perfectFor}.` : "",
      product.stylingTips ? `Styling tip: ${product.stylingTips}.` : "",
    ].filter(Boolean);
    const utterance = new SpeechSynthesisUtterance(parts.join(". "));
    utterance.lang = "en-IN";
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  // Stop speaking on unmount
  useEffect(() => {
    return () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); };
  }, []);
  const mainImage = product.images[activeImage] ?? product.images[0];

  // The arrows wrap, so neither one is ever a dead control — reaching the last
  // photo and pressing Next goes back to the first, the way a phone gallery
  // behaves. `% count` guards against a count of zero producing NaN.
  const imageCount = product.images.length;
  const showPrev = () => setActiveImage((i) => (imageCount ? (i - 1 + imageCount) % imageCount : 0));
  const showNext = () => setActiveImage((i) => (imageCount ? (i + 1) % imageCount : 0));

  // Left/right arrow keys move through the photos too, but only once the
  // gallery has been touched — hijacking them on page load would break normal
  // scrolling for someone who never looked at the pictures.
  useEffect(() => {
    if (imageCount < 2) return;
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (el instanceof HTMLElement && el.closest(".pdp-gallery") == null) return;
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "ArrowRight") showNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageCount]);

  // Record a page view and fetch today's approximate count.
  // Runs client-side so crawlers and prefetches don't inflate the number.
  useEffect(() => {
    fetch("/api/products/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.views > 0) setTodayViews(d.views); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  // Stock is tracked per size — fall back to the product total only for the
  // rare unsized product.
  const selectedSize = product.sizes.find((s) => s.label === size);
  const sizeStock = product.sizes.length ? (selectedSize?.stock ?? 0) : product.stock;
  const inStock = sizeStock > 0;
  const lowStock = inStock && sizeStock <= 5;

  // Switching to a smaller-stock size shouldn't leave a stale, too-high qty
  // selected.
  useEffect(() => {
    setQty((q) => Math.max(1, Math.min(q, sizeStock || 1)));
  }, [sizeStock]);

  function handleAdd() {
    addToCart({
      productId: product.id,
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.images[0]?.url ?? "",
      size,
      color,
      qty,
    });
  }

  return (
    <div className="pdp">
      <div className="pdp-gallery">
        <div className="pdp-stage">
          <img src={mainImage?.url} alt={product.name} />
          {product.images.length > 1 && (
            <>
              <button
                type="button"
                className="pdp-arrow prev"
                onClick={showPrev}
                aria-label="Previous photo"
              >
                ‹
              </button>
              <button
                type="button"
                className="pdp-arrow next"
                onClick={showNext}
                aria-label="Next photo"
              >
                ›
              </button>
              <span className="pdp-counter">
                {activeImage + 1} / {product.images.length}
              </span>
            </>
          )}
        </div>
        {product.images.length > 1 && (
          <div className="pdp-thumbs">
            {product.images.map((img, i) => (
              <button
                key={img.url + i}
                type="button"
                className={`pdp-thumb${i === activeImage ? " selected" : ""}`}
                onClick={() => setActiveImage(i)}
                aria-label={`Show photo ${i + 1}`}
              >
                <img src={img.url} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="pdp-info">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="p-cat">{product.category.name}</div>
            <h1>{product.name}</h1>
            <div className="pdp-sku">Product ID — {product.sku}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShareButton
              url={`${SITE.siteUrl}/product/${product.slug}`}
              title={product.name}
              price={formatINR(product.price)}
              size="large"
            />
            <WishlistButton productId={product.id} isLoggedIn={isLoggedIn} initialActive={wishlisted} size="large" />
          </div>
        </div>

        <div className="pdp-price">
          {formatINR(product.price)}
          {product.compareAtPrice && <span className="strike">{formatINR(product.compareAtPrice)}</span>}
        </div>
        <div className={`pdp-stock ${!inStock ? "out" : lowStock ? "low" : ""}`}>
          {!inStock
            ? `Out of stock${size ? ` in size ${size}` : ""}`
            : lowStock
            ? `Only ${sizeStock} left${size ? ` in size ${size}` : ""} — order soon`
            : "In stock · Ships in 3–5 business days"}
        </div>
        {todayViews >= 3 && (
          <div className="pdp-views">
            {todayViews} {todayViews === 1 ? "person" : "people"} viewed this today
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div className="pdp-desc" style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: toDisplayHtml(product.description) }} />
          <button
            type="button"
            className={`read-aloud-btn${speaking ? " active" : ""}`}
            onClick={toggleReadAloud}
            aria-label={speaking ? "Stop reading" : "Read aloud"}
            title={speaking ? "Stop reading" : "Read description aloud"}
          >
            {speaking ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </button>
        </div>

        <div className="field-block">
          <div className="field-label"><span>Color — {color}</span></div>
          <div className="color-options">
            {product.colors.map((c) => (
              <span
                key={c.name}
                className={`color-opt ${c.name === color ? "selected" : ""}`}
                style={{ background: c.hex }}
                title={c.name}
                onClick={() => setColor(c.name)}
              />
            ))}
          </div>
        </div>

        <div className="field-block">
          <div className="field-label size-label-row">
            <span>Size — {size}</span>
            <button type="button" className="size-help-link" onClick={() => setSizeGuideOpen(true)}>
              Sizing help
            </button>
          </div>
          <div className="size-options">
            {product.sizes.map((s) => {
              const soldOut = s.stock <= 0;
              return (
                <span
                  key={s.label}
                  className={`size-opt ${s.label === size ? "selected" : ""} ${soldOut ? "sold-out" : ""}`}
                  title={soldOut ? "Sold out in this size" : undefined}
                  onClick={() => !soldOut && setSize(s.label)}
                >
                  {s.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="qty-row">
          <div className="field-label" style={{ margin: 0 }}>Quantity</div>
          <div className="qty-stepper">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))}>–</button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(sizeStock || 1, q + 1))}>+</button>
          </div>
        </div>

        <div className="pdp-actions">
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={!inStock} onClick={handleAdd}>
            {inStock ? "Add to Bag" : "Out of Stock"}
          </button>
          <button
            className="btn btn-gold"
            style={{ flex: 1 }}
            disabled={!inStock}
            onClick={() => {
              handleAdd();
              router.push("/checkout");
            }}
          >
            Buy Now
          </button>
        </div>

        <SizeGuide open={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} currentSize={size} />

        <div className="trust-row">
          <span className="t">✓ Easy 7-day exchange</span>
          <span className="t">✓ Secure checkout</span>
          <span className="t">✓ Made across India</span>
        </div>

        <dl className="pdp-meta">
          {product.styleNotes && (
            <>
              <dt>Style</dt>
              <dd>{product.styleNotes}</dd>
            </>
          )}
          {product.perfectFor && (
            <>
              <dt>Perfect For</dt>
              <dd>{product.perfectFor}</dd>
            </>
          )}
          {product.bestWeather && (
            <>
              <dt>Best Weather</dt>
              <dd>{product.bestWeather}</dd>
            </>
          )}
          {product.stylingTips && (
            <>
              <dt>Styling Tip</dt>
              <dd>{product.stylingTips}</dd>
            </>
          )}
          <dt>Fabric &amp; Care</dt>
          <dd>{product.fabric}. Dry clean recommended for festive pieces; gentle machine wash for everyday cotton.</dd>
          <dt>Delivery</dt>
          <dd>We deliver across India. Free delivery on orders above ₹5,000 — below that, delivery charges are additional and confirmed based on your location. Cash on delivery available in select pincodes.</dd>
        </dl>
      </div>
    </div>
  );
}
