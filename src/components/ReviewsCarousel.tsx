"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type ReviewItem = {
  id: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  productName: string;
  productSlug: string;
};

export default function ReviewsCarousel({ reviews }: { reviews: ReviewItem[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % reviews.length);
  }, [reviews.length]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + reviews.length) % reviews.length);
  }, [reviews.length]);

  useEffect(() => {
    if (paused || reviews.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [paused, next, reviews.length]);

  if (reviews.length === 0) return null;

  const r = reviews[current];

  return (
    <div
      className="reviews-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="carousel-review" key={r.id}>
        <div className="stars" style={{ fontSize: 20, marginBottom: 10 }}>
          {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
        </div>
        {r.title && (
          <h3 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 8px", fontFamily: "var(--font-display)" }}>
            &ldquo;{r.title}&rdquo;
          </h3>
        )}
        <p style={{
          fontSize: 14.5,
          color: "var(--earth)",
          lineHeight: 1.6,
          maxWidth: 560,
          margin: "0 auto",
          fontStyle: "italic",
        }}>
          &ldquo;{r.body.length > 200 ? r.body.slice(0, 200).trimEnd() + "…" : r.body}&rdquo;
        </p>
        <div style={{ marginTop: 14 }}>
          <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--olive)" }}>
            — {r.customerName}
          </span>
          {r.verifiedPurchase && (
            <span style={{
              fontSize: 10.5,
              color: "#4c8c3c",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginLeft: 8,
              fontWeight: 600,
            }}>
              Verified
            </span>
          )}
        </div>
        <Link
          href={`/product/${r.productSlug}`}
          style={{ fontSize: 12, color: "var(--sage)", marginTop: 6, display: "inline-block" }}
        >
          on {r.productName}
        </Link>
      </div>

      {reviews.length > 1 && (
        <div className="carousel-controls">
          <button onClick={prev} aria-label="Previous review" className="carousel-arrow">‹</button>
          <div className="carousel-dots">
            {reviews.map((_, i) => (
              <button
                key={i}
                className={`carousel-dot${i === current ? " active" : ""}`}
                onClick={() => setCurrent(i)}
                aria-label={`Review ${i + 1}`}
              />
            ))}
          </div>
          <button onClick={next} aria-label="Next review" className="carousel-arrow">›</button>
        </div>
      )}
    </div>
  );
}
