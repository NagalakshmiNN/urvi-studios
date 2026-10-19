import { db } from "@/db";
import ReviewActions from "./ReviewActions";

export default async function AdminReviewsPage() {
  const reviews = await db.query.reviews.findMany({
    with: { product: true },
    orderBy: (r, { desc, asc }) => [
      // PENDING first, then APPROVED, then REJECTED
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
        {reviews.map((r) => (
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
                {r.photoUrl && (
                  <img
                    src={r.photoUrl}
                    alt="Review photo"
                    style={{
                      marginTop: 8,
                      maxWidth: 120,
                      maxHeight: 120,
                      borderRadius: 6,
                      objectFit: "cover",
                      border: "1px solid var(--line)",
                    }}
                  />
                )}
              </div>
              <ReviewActions reviewId={r.id} currentStatus={r.status} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
