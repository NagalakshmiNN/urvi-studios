import Link from "next/link";
import { db } from "@/db";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductCard from "@/components/ProductCard";
import { getCustomerSession } from "@/lib/auth";

export default async function HomePage() {
  const customerId = await getCustomerSession();

  const products = await db.query.products.findMany({
    where: (p, { eq }) => eq(p.isActive, true),
    with: { images: true, sizes: true, colors: true, category: true },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
    limit: 8,
  });

  let wishlistedIds = new Set<string>();
  if (customerId) {
    const rows = await db.query.wishlistItems.findMany({ where: (w, { eq }) => eq(w.customerId, customerId) });
    wishlistedIds = new Set(rows.map((r) => r.productId));
  }

  return (
    <>
      <SiteHeader active="Home" />

      <section className="hero">
        <div className="hero-art" aria-hidden="true" />
        <div className="hero-inner">
          <div className="eyebrow devanagari hero-tagline-dev">आत्मविश्वासवस्त्रम्</div>
          <div className="eyebrow">Everyday · Office · Occasion</div>
          <h1>Wear the woman
            <br /><em>you&apos;re becoming.</em></h1>
          <p className="lede">
            Premium festive wear, office wear and everyday fusion pieces — sourced from craftspeople across India, styled for the confident, modern woman.
          </p>
          <div className="hero-cta">
            <Link href="/shop" className="btn btn-gold">Shop the Edit</Link>
            <Link href="/about" className="btn btn-outline on-dark">Our Story</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Shop by moment</div>
            <h2>Everyday · Office · Occasion</h2>
          </div>
          <div className="category-grid">
            <Link href="/shop?cat=Everyday" className="category-card">
              <img src="/placeholders/hero-casual.svg" alt="Everyday wear" />
              <div className="overlay"><span>The Essentials</span><h3>Everyday</h3><div className="rule-mini" /></div>
            </Link>
            <Link href="/shop?cat=Office" className="category-card">
              <img src="/placeholders/hero-office.svg" alt="Office wear" />
              <div className="overlay"><span>Sharp &amp; Considered</span><h3>Office</h3><div className="rule-mini" /></div>
            </Link>
            <Link href="/shop?cat=Occasion" className="category-card">
              <img src="/placeholders/hero-festive.svg" alt="Occasion wear" />
              <div className="overlay"><span>Festive &amp; Fusion</span><h3>Occasion</h3><div className="rule-mini" /></div>
            </Link>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--sand)" }}>
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Signature Series</div>
            <h2>Who Are You Today?</h2>
            <p className="lede" style={{ margin: "14px auto 0" }}>Different versions of HER — pick the mood, we&apos;ll style the edit.</p>
          </div>
          <div className="mood-grid">
            <div className="mood-card"><div className="mood-mark">L</div><h4>The Leader</h4><p>Structured &amp; sharp</p></div>
            <div className="mood-card"><div className="mood-mark">E</div><h4>The Everyday Woman</h4><p>Effortless &amp; easy</p></div>
            <div className="mood-card"><div className="mood-mark">S</div><h4>The Social Butterfly</h4><p>Festive &amp; radiant</p></div>
            <div className="mood-card"><div className="mood-mark">M</div><h4>The Minimalist</h4><p>Clean &amp; considered</p></div>
            <div className="mood-card"><div className="mood-mark">D</div><h4>The Dreamer</h4><p>Soft &amp; fluid</p></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Confidence Drop</div>
            <h2>New &amp; Loved</h2>
          </div>
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} isLoggedIn={!!customerId} wishlisted={wishlistedIds.has(p.id)} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 44 }}>
            <Link href="/shop" className="btn btn-outline">View Full Collection</Link>
          </div>
        </div>
      </section>

      <section className="section quote-band" style={{ textAlign: "center" }}>
        <div className="art-wash" aria-hidden="true" />
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="eyebrow" style={{ color: "var(--gold-light)" }}>Her Girls</div>
          <h2 style={{ color: "var(--ivory)" }}>&quot;Your mood. Your moment. Your look.&quot;</h2>
          <p className="lede" style={{ color: "var(--sand)", margin: "0 auto", opacity: 0.9 }}>
            URVI Studios is built by Shilpa and Nagalakshmi, for women who refuse to choose between comfort, craft and confidence — because the right outfit isn&apos;t just fabric. It&apos;s who you become when you wear it.
          </p>
          <Link href="/about" className="btn btn-outline on-dark" style={{ marginTop: 26 }}>Meet the Founders</Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
