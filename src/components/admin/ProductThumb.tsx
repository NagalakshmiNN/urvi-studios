// A product's own photo, small, wherever a product is named on an admin
// screen. Recognising a piece by sight is faster than reading a name, and
// far faster than reading a Product ID.
//
// One component rather than an <img> repeated on each screen, because the
// fallback is the part that matters: a product with no photo yet must show a
// deliberate empty frame, not a broken-image icon. An <img> with an undefined
// `src` renders as a broken glyph in every browser — which is exactly what
// the Products screen was doing before this existed.

import Link from "next/link";

export type ThumbImage = { url: string; position?: number };

/** The photo the storefront leads with — position order, not insertion order. */
export function firstImageUrl(images: ThumbImage[] | null | undefined): string | null {
  if (!images || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return sorted[0]?.url ?? null;
}

export default function ProductThumb({
  url,
  name,
  size = "md",
}: {
  url: string | null | undefined;
  /** Used only for the tooltip — the name is always beside it, so alt is empty. */
  name?: string;
  size?: "sm" | "md";
}) {
  const cls = `prod-thumb prod-thumb-${size}`;
  if (!url) {
    // Not an <img>: nothing to load, so nothing to break.
    return <span className={`${cls} prod-thumb-empty`} title={name ? `${name} — no photo yet` : "No photo yet"} aria-hidden="true" />;
  }
  return <img src={url} alt="" title={name} className={cls} loading="lazy" decoding="async" />;
}

/**
 * Thumbnail and name together, the pairing used in most admin tables. Pass
 * `href` and it becomes the link to the product, so the photo is part of the
 * target rather than sitting dead beside it.
 */
export function ProductLabel({
  url,
  name,
  href,
  size = "md",
}: {
  url: string | null | undefined;
  name: string;
  href?: string;
  size?: "sm" | "md";
}) {
  const inner = (
    <>
      <ProductThumb url={url} name={name} size={size} />
      <span>{name}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="prod-label">
        {inner}
      </Link>
    );
  }
  return <span className="prod-label">{inner}</span>;
}
