import { db } from "@/db";
import ReviewActions from "./ReviewActions";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const reviews = await db.query.reviews.findMany({
    with: {
      product: true,
      media: { orderBy: (m, { asc }) => [asc(m.sortOrder)] },
    },
    orderBy: (r, { desc, asc }) => [
      asc(r.status),
      desc(r.createdAt),
    ],
  });

  const pendingCount = reviews.filter((r) => r.status === "PENDING").length;

  return (
    <>
      <div className="admin-header">
        <h1>Reviews{pendingCount > 0 ? ` (${pendingCount} pending)` : ""}</h1>
      </div>

      <div className="admin-card">
        {reviews.length === 0 && (
          <p style={{ padding: 20, color: "var(--sage)" }}>
            No reviews yet — customer reviews will appear here for moderation.
          </p>
        )}
        {reviews.map((r) => {
          const photos = r.media.filter((m) => m.kind === "photo");
          const video = r.media.find((m) => m.kind === "video");
          const audio = r.media.find((m) => m.kind === "audio");
          const fallbackPhoto = photos.length === 0 && !video && r.photoUrl;

          return (
            <div
              key={r.id}
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--line)",
                background: r.status === "PENDING" ? "rgba(169,130,56,0.06)" : "transparent",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14 }}>{r.customerName}</strong>
                    {r.verifiedPurchase && (
                      <span style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "rgba(76,140,60,0.12)",
                        color: "#4c8c3c",
                        fontWeight: 600,
                      }}>
                        Verified Purchase
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--sage)", marginTop: 2 }}>
                    on <strong>{r.product.name}</strong> ·{" "}
                    {r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 16, color: "#d4a017", letterSpacing: 1 }}>
                    {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                  </div>
                  {r.title && <div style={{ marginTop: 6, fontWeight: 600, fontSize: 14 }}>{r.title}</div>}
                  <p style={{ marginTop: 4, fontSize: 13.5, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{r.body}</p>

                  {/* Media display */}
                  {(photos.length > 0 || video || audio || fallbackPhoto) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      {fallbackPhoto && (
                        <img
                          src={r.photoUrl!}
                          alt="Review photo"
                          style={{ maxWidth: 120, maxHeight: 120, borderRadius: 6, objectFit: "cover", border: "1px solid var(--line)" }}
                        />
                      )}
                      {photos.map((p) => (
                        <img
                          key={p.id}
                          src={`/api/images/${p.assetId}`}
                          alt="Review photo"
                          style={{ maxWidth: 120, maxHeight: 120, borderRadius: 6, objectFit: "cover", border: "1px solid var(--line)" }}
                        />
                      ))}
                      {video && (
                        <video
                          src={`/api/images/${video.assetId}`}
                          controls
                          preload="metadata"
                          style={{ maxWidth: 200, maxHeight: 140, borderRadius: 6, border: "1px solid var(--line)" }}
                        />
                      )}
                      {audio && (
                        <audio
                          src={`/api/images/${audio.assetId}`}
                          controls
                          preload="metadata"
                          style={{ height: 36 }}
                        />
                      )}
                    </div>
                  )}
                </div>
                <ReviewActions reviewId={r.id} currentStatus={r.status} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
