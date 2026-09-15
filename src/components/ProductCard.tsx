import Link from "next/link";
import { formatINR } from "@/lib/format";
import { ProductCardData } from "@/lib/types";
import WishlistButton from "./WishlistButton";
import QuickAddButton from "./QuickAddButton";
import ShareButton from "./ShareButton";
import { SITE } from "@/lib/site-config";

export default function ProductCard({
  product,
  isLoggedIn,
  wishlisted,
}: {
  product: ProductCardData;
  isLoggedIn: boolean;
  wishlisted: boolean;
}) {
  // Quick-add from the card needs one concrete size to add — prefer one
  // that's actually in stock, since stock is now tracked per size.
  const pickSize =
    product.sizes.find((s) => s.stock > 0) ?? product.sizes[Math.floor(product.sizes.length / 2)];
  const inStock = (pickSize?.stock ?? product.stock) > 0;
  const midSize = pickSize?.label ?? "M";

  return (
    <div className="product-card">
      <Link href={`/product/${product.slug}`} className="thumb">
        {!inStock ? (
          <span className="out-of-stock-badge" style={{ left: 12, right: "auto" }}>Out of Stock</span>
        ) : (
          product.badge && <span className="badge">{product.badge}</span>
        )}
        <img src={product.images[0]?.url} alt={product.name} />
      </Link>
      {/* Share sits under the wishlist heart, so both stay clear of the badge
          in the top-left and of the image link behind them. */}
      <div className="card-actions">
        <WishlistButton productId={product.id} isLoggedIn={isLoggedIn} initialActive={wishlisted} />
        <ShareButton
          url={`${SITE.siteUrl}/product/${product.slug}`}
          title={product.name}
          price={formatINR(product.price)}
        />
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
      <QuickAddButton
        productId={product.id}
        sku={product.sku}
        slug={product.slug}
        name={product.name}
        price={product.price}
        image={product.images[0]?.url ?? ""}
        size={midSize}
        color={product.colors[0]?.name ?? ""}
        disabled={!inStock}
      />
    </div>
  );
}
