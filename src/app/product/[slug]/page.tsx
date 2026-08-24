import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { getCustomerSession } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductCard from "@/components/ProductCard";
import ProductDetailClient from "./ProductDetailClient";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const customerId = await getCustomerSession();

  const product = await db.query.products.findFirst({
    where: (p, { eq }) => eq(p.slug, slug),
    with: { images: true, sizes: true, colors: true, category: true },
  });

  if (!product) notFound();

  const reviews = await db.query.reviews.findMany({
    where: (r, { eq, and }) => and(eq(r.productId, product.id), eq(r.status, "APPROVED")),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  let wishlisted = false;
  if (customerId) {
    const w = await db.query.wishlistItems.findFirst({
      where: (w, { eq, and }) => and(eq(w.customerId, customerId), eq(w.productId, product.id)),
    });
    wishlisted = !!w;
  }

  const related = await db.query.products.findMany({
    where: (p, { eq, and, ne }) => and(eq(p.categoryId, product.categoryId), ne(p.id, product.id), eq(p.isActive, true)),
    with: { images: true, sizes: true, colors: true, category: true },
    limit: 4,
  });

  let relatedWishlisted = new Set<string>();
  if (customerId && related.length) {
    const rows = await db.query.wishlistItems.findMany({ where: (w, { eq }) => eq(w.customerId, customerId) });
    relatedWishlisted = new Set(rows.map((r) => r.productId));
  }

  return (
    <>
      <SiteHeader />
      <div className="container">
        <div className="breadcrumb" style={{ marginTop: 22 }}>
          <Link href="/">Home</Link> / <Link href={`/shop?cat=${product.category.parent}`}>{product.category.parent}</Link> / <span>{product.name}</span>
        </div>
      </div>

      <div className="container">
        <ProductDetailClient product={product} isLoggedIn={!!customerId} wishlisted={wishlisted} />
      </div>

      {reviews.length > 0 && (
        <div className="container">
          <div className="reviews-section" style={{ maxWidth: 700 }}>
            <div className="review-summary">
              <span className="avg">{avgRating.toFixed(1)}</span>
              <div>
                <div className="stars">{"★".repeat(Math.round(avgRating))}{"☆".repeat(5 - Math.round(avgRating))}</div>
                <div style={{ fontSize: 12.5, color: "var(--sage)" }}>{reviews.length} review{reviews.length !== 1 ? "s" : ""}</div>
              </div>
            </div>
            {reviews.map((r) => (
              <div key={r.id} className="review-card">
                <span className="who">{r.customerName}</span>
                {r.verifiedPurchase && <span className="verified">Verified Purchase</span>}
                <div className="stars" style={{ marginTop: 6 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                {r.title && <div className="title">{r.title}</div>}
                <div className="body-text">{r.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {related.length > 0 && (
        <section className="section" style={{ background: "var(--sand)" }}>
          <div className="container">
            <div className="section-head">
              <div className="eyebrow">You may also love</div>
              <h2>Complete the Look</h2>
            </div>
            <div className="product-grid">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} isLoggedIn={!!customerId} wishlisted={relatedWishlisted.has(p.id)} />
              ))}
            </div>
          </div>
        </section>
      )}

      <SiteFooter />
    </>
  );
}
