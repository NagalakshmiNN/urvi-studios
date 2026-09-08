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
  "co-ords": "Co-ords",
};

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

// Multi-value filter params (fabric/color/size) are stored as one query
// param each, values joined with "|" rather than "," since a few fabric
// descriptions in the product master sheet contain commas (e.g. "Rayon,
// hand-block printed").
const FILTER_SEP = "|";
function parseMulti(v?: string): string[] {
  return v ? v.split(FILTER_SEP).filter(Boolean) : [];
}

// Common sizes get a sensible left-to-right order; anything outside this
// list (a one-off label from the sheet) is sorted alphabetically after them
// rather than dropped.
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "Free Size"];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; sub?: string; sort?: string; fabric?: string; color?: string; size?: string }>;
}) {
  const { cat = "all", sub = "all", sort = "newest", fabric, color, size } = await searchParams;
  const fabricSel = parseMulti(fabric);
  const colorSel = parseMulti(color);
  const sizeSel = parseMulti(size);
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

  // Refine options (fabric/color/size) are built from whatever the category
  // filter left standing, before fabric/color/size are applied — so the
  // chips offered always reflect what's actually available to pick from
  // here, not stale options left over from a different category.
  const fabricOptions = Array.from(new Set(products.map((p) => p.fabric.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  const colorOptions = Array.from(
    products.reduce((map, p) => {
      for (const c of p.colors) if (!map.has(c.name)) map.set(c.name, c.hex);
      return map;
    }, new Map<string, string>())
  ).sort((a, b) => a[0].localeCompare(b[0]));
  const sizeOptions = Array.from(new Set(products.flatMap((p) => p.sizes.map((s) => s.label)))).sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a);
    const bi = SIZE_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  if (fabricSel.length) products = products.filter((p) => fabricSel.includes(p.fabric.trim()));
  if (colorSel.length) products = products.filter((p) => p.colors.some((c) => colorSel.includes(c.name)));
  if (sizeSel.length) products = products.filter((p) => p.sizes.some((s) => sizeSel.includes(s.label)));

  if (sort === "price-asc") products = [...products].sort((a, b) => a.price - b.price);
  else if (sort === "price-desc") products = [...products].sort((a, b) => b.price - a.price);
  else products = [...products].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  let wishlistedIds = new Set<string>();
  if (customerId) {
    const rows = await db.query.wishlistItems.findMany({ where: (w, { eq }) => eq(w.customerId, customerId) });
    wishlistedIds = new Set(rows.map((r) => r.productId));
  }

  const title = sub !== "all" ? SUB_LABELS[sub] : cat !== "all" ? cat : "Shop All";

  // Every href below is built from the same base params so switching one
  // filter (category, sort, or a refine chip) never drops the others.
  function baseParams() {
    const p = new URLSearchParams();
    if (cat !== "all") p.set("cat", cat);
    if (sub !== "all") p.set("sub", sub);
    if (sort !== "newest") p.set("sort", sort);
    if (fabricSel.length) p.set("fabric", fabricSel.join(FILTER_SEP));
    if (colorSel.length) p.set("color", colorSel.join(FILTER_SEP));
    if (sizeSel.length) p.set("size", sizeSel.join(FILTER_SEP));
    return p;
  }

  function chipHref(nextCat?: string, nextSub?: string) {
    const p = baseParams();
    if (nextCat && nextCat !== "all") p.set("cat", nextCat);
    else p.delete("cat");
    if (nextSub && nextSub !== "all") p.set("sub", nextSub);
    else p.delete("sub");
    const qs = p.toString();
    return `/shop${qs ? "?" + qs : ""}`;
  }

  function sortHref(nextSort: string) {
    const p = baseParams();
    if (nextSort !== "newest") p.set("sort", nextSort);
    else p.delete("sort");
    const qs = p.toString();
    return `/shop${qs ? "?" + qs : ""}`;
  }

  // Clicking a refine chip that's already selected removes it (toggle);
  // clicking an unselected one adds it. Everything else in the URL — the
  // category, sort, and the other two refine dimensions — is preserved.
  function refineHref(dimension: "fabric" | "color" | "size", value: string) {
    const current = dimension === "fabric" ? fabricSel : dimension === "color" ? colorSel : sizeSel;
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    const p = baseParams();
    if (next.length) p.set(dimension, next.join(FILTER_SEP));
    else p.delete(dimension);
    const qs = p.toString();
    return `/shop${qs ? "?" + qs : ""}`;
  }

  function clearRefineHref() {
    const p = baseParams();
    p.delete("fabric");
    p.delete("color");
    p.delete("size");
    const qs = p.toString();
    return `/shop${qs ? "?" + qs : ""}`;
  }

  const anyRefineActive = fabricSel.length > 0 || colorSel.length > 0 || sizeSel.length > 0;

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

          {(fabricOptions.length > 0 || colorOptions.length > 0 || sizeOptions.length > 0) && (
            <div className="refine-bar">
              {sizeOptions.length > 0 && (
                <div className="refine-group">
                  <span className="refine-label">Size</span>
                  <div className="refine-chips">
                    {sizeOptions.map((s) => (
                      <Link key={s} href={refineHref("size", s)} className={`chip-sm ${sizeSel.includes(s) ? "active" : ""}`}>
                        {s}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {colorOptions.length > 0 && (
                <div className="refine-group">
                  <span className="refine-label">Color</span>
                  <div className="refine-chips">
                    {colorOptions.map(([name, hex]) => (
                      <Link
                        key={name}
                        href={refineHref("color", name)}
                        className={`chip-sm chip-color ${colorSel.includes(name) ? "active" : ""}`}
                      >
                        <span className="chip-color-dot" style={{ background: hex }} />
                        {name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {fabricOptions.length > 0 && (
                <div className="refine-group">
                  <span className="refine-label">Fabric</span>
                  <div className="refine-chips">
                    {fabricOptions.map((f) => (
                      <Link key={f} href={refineHref("fabric", f)} className={`chip-sm ${fabricSel.includes(f) ? "active" : ""}`}>
                        {f}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {anyRefineActive && (
                <Link href={clearRefineHref()} className="refine-clear">
                  Clear filters
                </Link>
              )}
            </div>
          )}

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
