"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function ReviewForm({
  productId,
  isLoggedIn,
  hasExistingReview,
}: {
  productId: string;
  isLoggedIn: boolean;
  hasExistingReview: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoType, setPhotoType] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!isLoggedIn) {
    return (
      <div className="review-form-prompt">
        <a href="/account/login">Log in</a> to write a review.
      </div>
    );
  }

  if (hasExistingReview) {
    return (
      <div className="review-form-prompt">
        You have already reviewed this product. Thank you!
      </div>
    );
  }

  if (success) {
    return (
      <div className="review-form-prompt" style={{ color: "#4c8c3c" }}>
        Thank you for your review! It will appear once approved.
      </div>
    );
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Photo must be JPG, PNG or WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be under 5 MB.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotoPreview(dataUrl);
      setPhotoBase64(dataUrl.split(",")[1]);
      setPhotoType(file.type);
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoPreview(null);
    setPhotoBase64(null);
    setPhotoType(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a star rating.");
      return;
    }
    if (body.trim().length < 10) {
      setError("Please write at least 10 characters.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          rating,
          title: title.trim() || undefined,
          reviewBody: body.trim(),
          photoBase64: photoBase64 || undefined,
          photoContentType: photoType || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const displayRating = hoverRating || rating;

  if (!open) {
    return (
      <button className="btn btn-outline" style={{ marginTop: 16 }} onClick={() => setOpen(true)}>
        Write a Review
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="review-form">
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, margin: "0 0 16px" }}>
        Write a Review
      </h3>

      {/* Star selector */}
      <div className="review-stars-select">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`review-star${displayRating >= n ? " filled" : ""}`}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            {displayRating >= n ? "★" : "☆"}
          </button>
        ))}
        {rating > 0 && (
          <span style={{ fontSize: 12.5, color: "var(--sage)", marginLeft: 8 }}>
            {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
          </span>
        )}
      </div>

      {/* Title (optional) */}
      <input
        type="text"
        className="form-input"
        placeholder="Review title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        style={{ marginTop: 12 }}
      />

      {/* Body */}
      <textarea
        className="form-input"
        placeholder="Share your experience with this product..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={4}
        style={{ marginTop: 8, resize: "vertical" }}
      />
      <div style={{ fontSize: 11, color: "var(--sage)", textAlign: "right" }}>
        {body.length}/2000
      </div>

      {/* Photo upload */}
      <div style={{ marginTop: 4 }}>
        {!photoPreview ? (
          <label className="review-photo-label">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              style={{ display: "none" }}
            />
            <span className="btn btn-small btn-ghost" style={{ cursor: "pointer" }}>
              📷 Add a photo
            </span>
          </label>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <img
              src={photoPreview}
              alt="Preview"
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }}
            />
            <button type="button" className="btn btn-small btn-ghost" onClick={removePhoto} style={{ color: "#c83c3c" }}>
              Remove
            </button>
          </div>
        )}
      </div>

      {error && <p style={{ color: "#c83c3c", fontSize: 13, marginTop: 8 }}>{error}</p>}

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button type="submit" className="btn btn-gold" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit Review"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setOpen(false)}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
