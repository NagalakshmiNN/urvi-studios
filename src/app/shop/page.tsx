import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductCard from "@/components/ProductCard";
import { db } from "@/db";
import { getCustomerSession } from "@/lib/auth";
import Link from "next/link";

const SUB_LABELS: Record<string, string> = {
  "festive-wear": "Festive Wear",
  "office-wear": "Office Wear",
  "casual-wear": "Casual Wear",
  "short-tops": "Short Tops",
  kurta: "Kurta",
  "fusion-edit": "Fusion Edit",
};

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; sub?: string; sort?: string }>;
}) {
  const { cat = "all", sub = "all", sort = "newest" } = await searchParams;
  const customerId = await getCustomerSession();

  const categories = await db.query.categories.findMany({ orderBy: (c, { asc }) => [asc(c.position)] });

  let products = await db.query.products.findMany({
    where: (p, { eq }) => eq(p.isActive, true),
    with: { images: true, sizes: true, colors: true, category: true },
  });

  if (sub !== "all") {
    products = products.filter((p) => p.category.slug === sub);
  } else if (cat !== "all") {
    products = products.filter((p) => p.category.parent === cat);
  }

  if (sort === "price-asc") products = [...products].sort((a, b) => a.price - b.price);
  else if (sort === "price-desc") products = [...products].sort((a, b) => b.price - a.price);
  else products = [...products].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  let wishlistedIds = new Set<string>();
  if (customerId) {
    const rows = await db.query.wishlistItems.findMany({ where: (w, { eq }) => eq(w.customerId, customerId) });
    wishlistedIds = new Set(rows.map((r) => r.productId));
  }

  const title = sub !== "all" ? SUB_LABELS[sub] : cat !== "all" ? cat : "Shop All";

  function chipHref(nextCat?: string, nextSub?: string) {
    const p = new URLSearchParams();
    if (nextCat && nextCat !== "all") p.set("cat", nextCat);
    if (nextSub && nextSub !== "all") p.set("sub", nextSub);
    if (sort !== "newest") p.set("sort", sort);
    const qs = p.toString();
    return `/shop${qs ? "?" + qs : ""}`;
  }

  function sortHref(nextSort: string) {
    const p = new URLSearchParams();
    if (cat !== "all") p.set("cat", cat);
    if (sub !== "all") p.set("sub", sub);
    if (nextSort !== "newest") p.set("sort", nextSort);
    const qs = p.toString();
    return `/shop${qs ? "?" + qs : ""}`;
  }

  return (
    <>
      <SiteHeader active="Shop All" />
      <div className="page-hero container">
        <div className="eyebrow">The Collection</div>
        <h1>{title}</h1>
        <p className="lede" style={{ margin: "0 auto" }}>
          Curated from manufacturers across India — festive, office, casual and fusion pieces, refreshed regularly.
        </p>
      </div>
      <section className="section" style={{ paddingTop: 30 }}>
        <div className="container">
          <div className="filter-bar">
            <Link href={chipHref("all", "all")} className={`chip ${cat === "all" && sub === "all" ? "active" : ""}`}>All</Link>
            {["Everyday", "Office", "Occasion"].map((c) => (
              <Link key={c} href={chipHref(c, "all")} className={`chip ${cat === c ? "active" : ""}`}>{c}</Link>
            ))}
            <span style={{ width: 1, background: "var(--line)", margin: "0 6px" }} />
            {categories.map((c) => (
              <Link key={c.slug} href={chipHref("all", c.slug)} className={`chip ${sub === c.slug ? "active" : ""}`}>{c.name}</Link>
            ))}
          </div>

          <div className="toolbar">
            <span style={{ fontSize: 13, color: "var(--sage)" }}>{products.length} pieces</span>
            <div style={{ display: "flex", gap: 8 }}>
              {SORTS.map((s) => (
                <Link key={s.value} href={sortHref(s.value)} className={`chip ${sort === s.value ? "active" : ""}`} style={{ borderRadius: 2 }}>
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          {products.length ? (
            <div className="product-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} isLoggedIn={!!customerId} wishlisted={wishlistedIds.has(p.id)} />
              ))}
            </div>
          ) : (
            <div className="empty-state">No pieces match this filter just yet — check back soon.</div>
          )}
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
