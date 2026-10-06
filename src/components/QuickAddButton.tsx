"use client";

import { useEffect, useState } from "react";
import { addToCart } from "@/lib/cart";

export default function QuickAddButton({
  productId,
  sku,
  slug,
  name,
  price,
  image,
  size,
  color,
  disabled,
}: {
  productId: string;
  sku: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  size: string;
  color: string;
  disabled?: boolean;
}) {
  const [showAdded, setShowAdded] = useState(false);

  useEffect(() => {
    if (!showAdded) return;
    const t = setTimeout(() => setShowAdded(false), 2000);
    return () => clearTimeout(t);
  }, [showAdded]);

  return (
    <>
      <button
        className="add-link"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          addToCart({ productId, sku, slug, name, price, image, size, color, qty: 1 });
          setShowAdded(true);
        }}
      >
        {disabled ? "Out of Stock" : "Add to Bag"}
      </button>
      {showAdded && <span className="added-to-bag-msg">Added to bag ✓</span>}
    </>
  );
}
