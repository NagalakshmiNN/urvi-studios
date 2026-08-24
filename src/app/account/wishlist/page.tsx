import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AccountNav from "@/components/AccountNav";
import ProductCard from "@/components/ProductCard";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getCustomerSession } from "@/lib/auth";
import Link from "next/link";

export default async function WishlistPage() {
  const customerId = (await getCustomerSession())!;

  const rows = await db.query.wishlistItems.findMany({
    where: eq(schema.wishlistItems.customerId, customerId),
    with: { product: { with: { images: true, sizes: true, colors: true, category: true } } },
  });
  const products = rows.map((r) => r.product).filter((p) => p && p.isActive);

  return (
    <>
      <SiteHeader active="Account" />
      <div className="page-hero container">
        <div className="eyebrow">My Account</div>
        <h1>Your Wishlist</h1>
      </div>
      <div className="container account-layout">
        <AccountNav active="Wishlist" />
        <div>
          {products.length === 0 ? (
            <div className="empty-state">
              <h3>Your wishlist is empty</h3>
              <p>Tap the heart on any piece to save it here.</p>
              <Link href="/shop" className="btn btn-outline" style={{ marginTop: 16 }}>Browse the Collection</Link>
            </div>
          ) : (
            <div className="product-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} isLoggedIn={true} wishlisted={true} />
              ))}
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
