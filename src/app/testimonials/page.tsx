import Link from "next/link";
import { db } from "@/db";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Customer Reviews | URVI Studios",
  description: "Read what our customers say about URVI Studios — real reviews from verified buyers.",
};

export default async function TestimonialsPage() {
  const reviews = await db.query.reviews.findMany({
    where: (r, { eq }) => eq(r.status, "APPROVED"),
    with: {
      product: true,
      media: { with: { asset: true }, orderBy: (m, { asc }) => [asc(m.sortOrder)] },
    },
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  return (
    <>
      <SiteHeader />

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <div className="breadcrumb" style={{ marginBottom: 24 }}>
            <Link href="/">Home</Link> / <span>Customer Reviews</span>
          </div>

          <div className="section-head" style={{ textAlign: "center", marginBottom: 36 }}>
            <div className="eyebrow">From Our Customers</div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, margin: "8px 0 0" }}>
              What They&apos;re Saying
            </h1>
            {reviews.length > 0 && (
              <div style={{ marginTop: 14, display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
                <span className="stars" style={{ fontSize: 22 }}>
                  {"★".repeat(Math.round(avgRating))}{"☆".repeat(5 - Math.round(avgRating))}
                </span>
                <span style={{ fontSize: 14, color: "var(--sage)" }}>
                  {avgRating.toFixed(1)} from {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          {reviews.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--sage)", padding: "40px 0" }}>
              No reviews yet — be the first to share your experience!
            </p>
          )}

          <div className="testimonials-grid">
            {reviews.map((r) => {
              const photos = r.media.filter((m) => m.kind === "photo");
              const video = r.media.find((m) => m.kind === "video");
              const audio = r.media.find((m) => m.kind === "audio");
              // Fallback: use legacy photoUrl if no media rows
              const fallbackPhoto = photos.length === 0 && !video && r.photoUrl;

              return (
                <div key={r.id} className="testimonial-card">
                  {/* Media gallery */}
                  {(photos.length > 0 || video || fallbackPhoto) && (
                    <div className="testimonial-media">
                      {fallbackPhoto && (
                        <img
                          src={r.photoUrl!}
                          alt={`Review by ${r.customerName}`}
                          className="testimonial-photo"
                        />
                      )}
                      {photos.length === 1 && !video && (
                        <img
                          src={`/api/images/${photos[0].assetId}`}
                          alt={`Review by ${r.customerName}`}
                          className="testimonial-photo"
                        />
                      )}
                      {photos.length > 1 && (
                        <div className="testimonial-photo-grid">
                          {photos.map((p, i) => (
                            <img
                              key={p.id}
                              src={`/api/images/${p.assetId}`}
                              alt={`Photo ${i + 1}`}
                              className="testimonial-photo-small"
                            />
                          ))}
                        </div>
                      )}
                      {video && (
                        <video
                          src={`/api/images/${video.assetId}`}
                          controls
                          preload="metadata"
                          className="testimonial-video"
                        />
                      )}
                    </div>
                  )}

                  <div className="testimonial-body">
                    <div className="stars" style={{ marginBottom: 6 }}>
                      {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                    </div>
                    {r.title && (
                      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{r.title}</h3>
                    )}
                    <p style={{ fontSize: 13.5, color: "var(--earth)", lineHeight: 1.55, margin: 0 }}>
                      {r.body}
                    </p>

                    {audio && (
                      <div style={{ marginTop: 10 }}>
                        <audio
                          src={`/api/images/${audio.assetId}`}
                          controls
                          preload="metadata"
                          style={{ width: "100%", height: 36 }}
                        />
                      </div>
                    )}

                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--olive)" }}>
                        {r.customerName}
                      </span>
                      {r.verifiedPurchase && (
                        <span style={{
                          fontSize: 10.5,
                          color: "#4c8c3c",
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          fontWeight: 600,
                        }}>
                          Verified Purchase
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/product/${r.product.slug}`}
                      style={{ fontSize: 12, color: "var(--sage)", marginTop: 4, display: "inline-block" }}
                    >
                      on {r.product.name} →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
