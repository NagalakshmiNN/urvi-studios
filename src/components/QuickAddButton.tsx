"use client";

import { addToCart } from "@/lib/cart";

export default function QuickAddButton({
  productId,
  slug,
  name,
  price,
  image,
  size,
  color,
  disabled,
}: {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  size: string;
  color: string;
  disabled?: boolean;
}) {
  return (
    <button
      className="add-link"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addToCart({ productId, slug, name, price, image, size, color, qty: 1 });
      }}
    >
      {disabled ? "Out of Stock" : "Add to Bag"}
    </button>
  );
}
