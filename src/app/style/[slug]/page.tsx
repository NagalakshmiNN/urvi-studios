import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductCard from "@/components/ProductCard";
import { db } from "@/db";
import { getCustomerSession } from "@/lib/auth";
import { getStyleGuide, STYLE_GUIDES } from "@/lib/style-guides";

export function generateStaticParams() {
  return STYLE_GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function StyleGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getStyleGuide(slug);
  if (!guide) notFound();

  const customerId = await getCustomerSession();

  const allProducts = await db.query.products.findMany({
    where: (p, { eq }) => eq(p.isActive, true),
    with: { images: true, sizes: true, colors: true, category: true },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });
  const products = allProducts.filter((p) => p.category.slug === guide.categorySlug).slice(0, 8);

  let wishlistedIds = new Set<string>();
  if (customerId) {
    const rows = await db.query.wishlistItems.findMany({ where: (w, { eq }) => eq(w.customerId, customerId) });
    wishlistedIds = new Set(rows.map((r) => r.productId));
  }

  return (
    <>
      <SiteHeader />

      <div className="page-hero container">
        <div className="eyebrow">{guide.eyebrow}</div>
        <h1>{guide.heading}</h1>
        <p className="lede" style={{ maxWidth: 640, margin: "16px auto 0" }}>{guide.intro}</p>
      </div>

      <section className="section" style={{ paddingTop: 10 }}>
        <div className="container">
          <div className="guide-tips-grid">
            {guide.tips.map((tip) => (
              <div className="guide-tip-card" key={tip.title}>
                <h4>{tip.title}</h4>
                <p>{tip.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 10, background: "var(--sand)" }}>
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Shop the Edit</div>
            <p className="lede" style={{ margin: "10px auto 0" }}>{guide.closingNote}</p>
          </div>
          {products.length > 0 ? (
            <div className="product-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} isLoggedIn={!!customerId} wishlisted={wishlistedIds.has(p.id)} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>We&apos;re curating this edit right now — check back soon, or see everything in the meantime.</p>
              <Link href="/shop" className="btn btn-outline">Shop All</Link>
            </div>
          )}
          <div style={{ textAlign: "center", marginTop: 36 }}>
            <Link href="/shop" className="btn btn-outline">Browse the Full Collection</Link>
          </div>
        </div>
      </section>

      <section className="section" style={{ textAlign: "center", paddingTop: 10 }}>
        <div className="container">
          <div className="eyebrow">More Occasions</div>
          <div className="mood-grid" style={{ marginTop: 20 }}>
            {STYLE_GUIDES.filter((g) => g.slug !== guide.slug).map((g) => (
              <Link href={`/style/${g.slug}`} className="mood-card" key={g.slug}>
                <div className="mood-mark">{g.mark}</div>
                <h4>{g.cardTitle}</h4>
                <p>{g.cardSubtitle}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
