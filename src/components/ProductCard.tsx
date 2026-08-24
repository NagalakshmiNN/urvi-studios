import Link from "next/link";
import { formatINR } from "@/lib/format";
import { ProductCardData } from "@/lib/types";
import WishlistButton from "./WishlistButton";
import QuickAddButton from "./QuickAddButton";

export default function ProductCard({
  product,
  isLoggedIn,
  wishlisted,
}: {
  product: ProductCardData;
  isLoggedIn: boolean;
  wishlisted: boolean;
}) {
  const inStock = product.stock > 0;
  const midSize = product.sizes[Math.floor(product.sizes.length / 2)]?.label ?? "M";

  return (
    <div className="product-card">
      <Link href={`/product/${product.slug}`} className="thumb">
        {!inStock ? (
          <span className="out-of-stock-badge" style={{ left: 12, right: "auto" }}>Out of Stock</span>
        ) : (
          product.badge && <span className="badge">{product.badge}</span>
        )}
        <img src={product.images[0]?.url} alt={product.name} />
        <QuickAddButton
          productId={product.id}
          slug={product.slug}
          name={product.name}
          price={product.price}
          image={product.images[0]?.url ?? ""}
          size={midSize}
          color={product.colors[0]?.name ?? ""}
          disabled={!inStock}
        />
      </Link>
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 3 }}>
        <WishlistButton productId={product.id} isLoggedIn={isLoggedIn} initialActive={wishlisted} />
      </div>
      <Link href={`/product/${product.slug}`}>
        <div className="p-cat">{product.category.name}</div>
        <div className="p-name">{product.name}</div>
        <div className="p-price">
          {formatINR(product.price)}
          {product.compareAtPrice && <span className="strike">{formatINR(product.compareAtPrice)}</span>}
        </div>
        <div className="swatches">
          {product.colors.map((c) => (
            <span key={c.name} className="swatch-dot" style={{ background: c.hex }} title={c.name} />
          ))}
        </div>
      </Link>
    </div>
  );
}
