import Link from "next/link";
import { db } from "@/db";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductCard from "@/components/ProductCard";
import RollingCategoryImage from "@/components/RollingCategoryImage";
import { getCustomerSession } from "@/lib/auth";
import { STYLE_GUIDES } from "@/lib/style-guides";
import { formatINR } from "@/lib/format";
import { FREE_SHIP_THRESHOLD } from "@/lib/order-pricing";
import { SIZE_CHART } from "@/lib/size-guide";

const CATEGORY_IMAGE_LIMIT = 6;

export default async function HomePage() {
  const customerId = await getCustomerSession();

  const products = await db.query.products.findMany({
    where: (p, { eq }) => eq(p.isActive, true),
    with: { images: true, sizes: true, colors: true, category: true },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
    limit: 8,
  });

  // A handful of real photos per parent group (Everyday/Office/Occasion),
  // newest first, to roll through in the homepage circles — no separate
  // "category image" upload needed, since the catalog already has real
  // product photos to draw from.
  const forRolling = await db.query.products.findMany({
    where: (p, { eq }) => eq(p.isActive, true),
    with: { images: true, category: true },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });
  const imagesByParent: Record<string, string[]> = { Everyday: [], Office: [], Occasion: [] };
  // One representative photo per category, for the occasion tiles below. A
  // real uploaded photo always beats the category illustration, so the map is
  // filled from real photos first and only falls back if a category has none.
  const realPhotoByCategory = new Map<string, string>();
  const anyPhotoByCategory = new Map<string, string>();
  for (const p of forRolling) {
    const parent = p.category.parent;
    const url = p.images[0]?.url;
    if (url) {
      if (!anyPhotoByCategory.has(p.category.slug)) anyPhotoByCategory.set(p.category.slug, url);
      if (url.startsWith("/api/images/") && !realPhotoByCategory.has(p.category.slug)) {
        realPhotoByCategory.set(p.category.slug, url);
      }
    }
    // Only real uploaded photos are worth rolling through — most products
    // still carry a category placeholder illustration until a real photo
    // is uploaded, and rotating between copies of the same static SVG (or
    // between illustrations that don't clearly read as different) isn't
    // useful. A category with no real photos yet just shows its one static
    // illustration, same as before.
    if (parent && url?.startsWith("/api/images/") && imagesByParent[parent] && imagesByParent[parent].length < CATEGORY_IMAGE_LIMIT) {
      imagesByParent[parent].push(url);
    }
  }

  // The First Look band: the newest piece, shown large, with the three next
  // newest beside it. `products` is already newest-first, so this is the same
  // ordering the New & Loved grid uses — deliberately, so the hero piece is
  // recognisable when the visitor scrolls past it again.
  const firstLook = products[0] ?? null;
  const alsoNew = products.slice(1, 4);
  const firstLookSizes = firstLook ? firstLook.sizes.filter((s) => s.stock > 0).map((s) => s.label) : [];

  /**
   * A real uploaded photo for this category, or nothing.
   *
   * Deliberately NOT falling back to the category illustration: those SVGs
   * carry their own baked-in lettering ("COMING SOON", the category name), so
   * an occasion title laid over one collides with type that's part of the
   * picture. A tile with no real photo renders as a typographic card instead —
   * which reads as a deliberate choice, and turns into a photograph on its own
   * the moment a real one is uploaded for that category.
   */
  function occasionImage(categorySlug: string): string | null {
    return realPhotoByCategory.get(categorySlug) ?? null;
  }

  /** The seed data leaves fabric as this when there's nothing real to say. */
  const PLACEHOLDER_FABRIC = /^see description$/i;

  // Category slug → display name, for the occasion tiles that have no photo.
  const categoryNames = new Map(forRolling.map((p) => [p.category.slug, p.category.name]));

  // Six occasion tiles, each led by a real garment rather than a monogram.
  // The rest of the guides stay reachable as the slim chip row underneath.
  const featuredGuides = STYLE_GUIDES.slice(0, 6);
  const remainingGuides = STYLE_GUIDES.slice(6);

  let wishlistedIds = new Set<string>();
  if (customerId) {
    const rows = await db.query.wishlistItems.findMany({ where: (w, { eq }) => eq(w.customerId, customerId) });
    wishlistedIds = new Set(rows.map((r) => r.productId));
  }

  return (
    <>
      <SiteHeader active="Home" />

      <section className="hero">
        <div className="hero-inner">
          <div className="eyebrow devanagari hero-tagline-dev">आत्मविश्वासवस्त्रम्</div>
          <div className="eyebrow">Everyday · Office · Occasion</div>
          <h1>Wear the woman
            <br /><em>you&apos;re becoming.</em></h1>
          <hr className="rule" />
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
            <h2>Everyday <span className="flow">·</span> Office <span className="flow">·</span> Occasion</h2>
          </div>
          <div className="category-grid">
            <Link href="/shop?cat=Everyday" className="category-card">
              <RollingCategoryImage images={imagesByParent.Everyday} fallback="/placeholders/hero-casual.svg" alt="Everyday wear" />
              <div className="overlay"><span>The Essentials</span><h3>Everyday</h3><div className="rule-mini" /></div>
            </Link>
            <Link href="/shop?cat=Office" className="category-card">
              <RollingCategoryImage images={imagesByParent.Office} fallback="/placeholders/hero-office.svg" alt="Office wear" />
              <div className="overlay"><span>Sharp &amp; Considered</span><h3>Office</h3><div className="rule-mini" /></div>
            </Link>
            <Link href="/shop?cat=Occasion" className="category-card">
              <RollingCategoryImage images={imagesByParent.Occasion} fallback="/placeholders/hero-festive.svg" alt="Occasion wear" />
              <div className="overlay"><span>Festive &amp; Fusion</span><h3>Occasion</h3><div className="rule-mini" /></div>
            </Link>
          </div>
        </div>
      </section>

      {/* First Look — the newest piece, large and in its own photo, with the
          facts a first-time visitor actually needs: what it's made of, what
          it's for, and which sizes are genuinely on the rail right now.
          Everything here is read from the catalog, so it moves on its own as
          stock changes rather than needing to be rewritten. */}
      {firstLook && (
        <section className="section first-look">
          <div className="container">
            <div className="first-look-grid">
              <Link href={`/product/${firstLook.slug}`} className="first-look-image">
                <img
                  src={firstLook.images[0]?.url ?? `/placeholders/${firstLook.category.slug}.svg`}
                  alt={firstLook.name}
                />
                <span className="first-look-flag">Just in</span>
              </Link>

              <div className="first-look-body">
                <div className="eyebrow">First Look</div>
                <h2>{firstLook.name}</h2>
                <div className="first-look-price">{formatINR(firstLook.price)}</div>
                {firstLook.fabric && !PLACEHOLDER_FABRIC.test(firstLook.fabric.trim()) && (
                  <p className="first-look-line">
                    <strong>Made of</strong> {firstLook.fabric}
                  </p>
                )}
                {firstLook.perfectFor && (
                  <p className="first-look-line">
                    <strong>Wear it to</strong> {firstLook.perfectFor}
                  </p>
                )}
                {firstLookSizes.length > 0 && (
                  <p className="first-look-line">
                    <strong>On the rail</strong> {firstLookSizes.join(" · ")}
                  </p>
                )}
                <div className="first-look-cta">
                  <Link href={`/product/${firstLook.slug}`} className="btn btn-gold">See this piece</Link>
                  <Link href="/shop" className="btn btn-outline">Everything new</Link>
                </div>

                {alsoNew.length > 0 && (
                  <div className="first-look-also">
                    <span className="first-look-also-label">Also just in</span>
                    <div className="first-look-also-row">
                      {alsoNew.map((p) => (
                        <Link key={p.id} href={`/product/${p.slug}`} className="first-look-also-card" title={p.name}>
                          <img src={p.images[0]?.url ?? `/placeholders/${p.category.slug}.svg`} alt="" />
                          <span>{p.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Shop by occasion, in real clothes. This replaces a grid of lettered
          circles: a monogram tells a first-time visitor nothing about what
          she'd be buying, and a photograph of the actual garment tells her
          most of it. */}
      <section className="section" style={{ background: "var(--sand)" }}>
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Shop the look</div>
            <h2>Dressing for Something?</h2>
            <p className="lede" style={{ margin: "14px auto 0" }}>
              Real occasions, styled with real pieces — pick the day you&apos;re dressing for.
            </p>
          </div>

          <div className="occasion-grid">
            {featuredGuides.map((g) => {
              const photo = occasionImage(g.categorySlug);
              return (
                <Link
                  href={`/style/${g.slug}`}
                  className={`occasion-card${photo ? "" : " no-photo"}`}
                  key={g.slug}
                >
                  {photo && <img src={photo} alt="" />}
                  <div className="occasion-overlay">
                    {/* The category name only appears on a card with no photo —
                        it fills the space a photograph would have used, and it
                        tells her customer what's actually inside the guide. */}
                    {!photo && categoryNames.get(g.categorySlug) && (
                      <span className="occasion-cat">{categoryNames.get(g.categorySlug)}</span>
                    )}
                    <h3>{g.cardTitle}</h3>
                    <p>{g.cardSubtitle}</p>
                    {!photo && <span className="occasion-go">See the edit →</span>}
                  </div>
                </Link>
              );
            })}
          </div>

          {remainingGuides.length > 0 && (
            <div className="occasion-more">
              <span className="occasion-more-label">Also styled for</span>
              <div className="occasion-more-chips">
                {remainingGuides.map((g) => (
                  <Link key={g.slug} href={`/style/${g.slug}`} className="chip">
                    {g.cardTitle}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* The plain promises, stated once, in the middle of the page rather
          than buried in the footer. A brand-new label is an unknown quantity
          to anyone arriving for the first time, and these are the four things
          that answer "is this safe to buy from". Every number here is the
          real one the checkout and the size guide use. */}
      <section className="section assurance">
        <div className="container">
          <div className="assurance-grid">
            <div className="assurance-item">
              <h4>Exchange within 7 days</h4>
              <p>Wrong size, wrong call — send it back and we&apos;ll swap it.</p>
            </div>
            <div className="assurance-item">
              <h4>Free delivery above {formatINR(FREE_SHIP_THRESHOLD)}</h4>
              <p>Delivered across India. Below that, charges are confirmed by your pincode.</p>
            </div>
            <div className="assurance-item">
              <h4>{SIZE_CHART[0].label} to {SIZE_CHART[SIZE_CHART.length - 1].label}</h4>
              <p>Every piece carries a sizing guide with real measurements, so you order once.</p>
            </div>
            <div className="assurance-item">
              <h4>Sourced across India</h4>
              <p>Bought from craftspeople and small makers, not pulled off a bulk catalogue.</p>
            </div>
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
