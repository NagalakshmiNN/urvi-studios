"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatINR } from "@/lib/format";
import { addToCart } from "@/lib/cart";
import WishlistButton from "@/components/WishlistButton";

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
        <img src={product.images[0]?.url} alt={product.name} />
      </div>
      <div className="pdp-info">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="p-cat">{product.category.name}</div>
            <h1>{product.name}</h1>
            <div className="pdp-sku">Product ID — {product.sku}</div>
          </div>
          <WishlistButton productId={product.id} isLoggedIn={isLoggedIn} initialActive={wishlisted} size="large" />
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
        <p className="pdp-desc">{product.description}</p>

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
          <div className="field-label"><span>Size — {size}</span></div>
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
          <dt>Shipping</dt>
          <dd>Free shipping across India on orders above ₹2,999. Cash on delivery available in select pincodes.</dd>
        </dl>
      </div>
    </div>
  );
}
