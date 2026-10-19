"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type MediaFile = {
  kind: "photo" | "video" | "audio";
  file: File;
  preview: string; // data URL or blob URL
  base64?: string;
  contentType: string;
};

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav"]);

const MAX_PHOTO_MB = 5;
const MAX_VIDEO_MB = 50;
const MAX_AUDIO_MB = 10;
const MAX_PHOTOS = 5;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const photoCount = media.filter((m) => m.kind === "photo").length;
  const hasVideo = media.some((m) => m.kind === "video");
  const hasAudio = media.some((m) => m.kind === "audio");

  if (!isLoggedIn) {
    return (
      <div className="rf-prompt">
        <a href="/account/login" className="rf-login-link">Log in</a> to write a review.
      </div>
    );
  }

  if (hasExistingReview) {
    return (
      <div className="rf-prompt rf-prompt--done">
        <span className="rf-check">✓</span> You have already reviewed this product. Thank you!
      </div>
    );
  }

  if (success) {
    return (
      <div className="rf-prompt rf-prompt--success">
        <span className="rf-check">✓</span> Thank you for your review! It will appear once approved.
      </div>
    );
  }

  function addMediaFile(file: File, kind: "photo" | "video" | "audio") {
    const maxMB = kind === "photo" ? MAX_PHOTO_MB : kind === "video" ? MAX_VIDEO_MB : MAX_AUDIO_MB;
    if (file.size > maxMB * 1024 * 1024) {
      setError(`${kind === "photo" ? "Photo" : kind === "video" ? "Video" : "Audio"} must be under ${maxMB} MB.`);
      return;
    }
    const preview = URL.createObjectURL(file);
    setMedia((prev) => [...prev, { kind, file, preview, contentType: file.type }]);
    setError("");
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      if (photoCount + i >= MAX_PHOTOS) {
        setError(`Maximum ${MAX_PHOTOS} photos allowed.`);
        break;
      }
      const f = files[i];
      if (!PHOTO_TYPES.has(f.type)) {
        setError("Photos must be JPG, PNG or WEBP.");
        continue;
      }
      addMediaFile(f, "photo");
    }
    if (photoRef.current) photoRef.current.value = "";
  }

  function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!VIDEO_TYPES.has(file.type)) {
      setError("Video must be MP4, WebM or MOV.");
      return;
    }
    addMediaFile(file, "video");
    if (videoRef.current) videoRef.current.value = "";
  }

  function handleAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!AUDIO_TYPES.has(file.type)) {
      setError("Audio must be MP3, M4A, WebM, OGG or WAV.");
      return;
    }
    addMediaFile(file, "audio");
    if (audioRef.current) audioRef.current.value = "";
  }

  function removeMedia(idx: number) {
    setMedia((prev) => {
      const item = prev[idx];
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((_, i) => i !== idx);
    });
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
      // Convert all media files to base64
      const mediaPayload = await Promise.all(
        media.map(async (m, i) => ({
          kind: m.kind,
          base64: await fileToBase64(m.file),
          contentType: m.contentType,
          sortOrder: i,
        }))
      );

      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          rating,
          title: title.trim() || undefined,
          reviewBody: body.trim(),
          media: mediaPayload.length > 0 ? mediaPayload : undefined,
          // Legacy single-photo fields for backward compat
          photoBase64: undefined,
          photoContentType: undefined,
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
  const ratingLabels = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

  if (!open) {
    return (
      <button className="btn btn-gold rf-open-btn" onClick={() => setOpen(true)}>
        ✍ Write a Review
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rf-form">
      <h3 className="rf-heading">Write a Review</h3>

      {/* Star selector */}
      <div className="rf-section">
        <label className="rf-label">Your Rating</label>
        <div className="rf-stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`rf-star${displayRating >= n ? " rf-star--filled" : ""}`}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            >
              ★
            </button>
          ))}
          {rating > 0 && (
            <span className="rf-rating-label">{ratingLabels[rating]}</span>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="rf-section">
        <label className="rf-label" htmlFor="rf-title">Title <span className="rf-optional">(optional)</span></label>
        <input
          id="rf-title"
          type="text"
          className="rf-input"
          placeholder="Sum up your experience in a few words"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
      </div>

      {/* Body */}
      <div className="rf-section">
        <label className="rf-label" htmlFor="rf-body">Your Review</label>
        <textarea
          id="rf-body"
          className="rf-textarea"
          placeholder="What did you like or dislike? How was the fit and fabric? Would you recommend this to others?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={6}
        />
        <div className="rf-char-count">{body.length} / 2000</div>
      </div>

      {/* Media section */}
      <div className="rf-section">
        <label className="rf-label">Add Media <span className="rf-optional">(optional)</span></label>
        <p className="rf-media-hint">
          Photos, a video or a voice note help other shoppers — and get your review featured!
        </p>

        {/* Media previews */}
        {media.length > 0 && (
          <div className="rf-media-grid">
            {media.map((m, i) => (
              <div key={i} className={`rf-media-item rf-media-item--${m.kind}`}>
                {m.kind === "photo" && (
                  <img src={m.preview} alt={`Preview ${i + 1}`} className="rf-media-thumb" />
                )}
                {m.kind === "video" && (
                  <video src={m.preview} className="rf-media-thumb" muted />
                )}
                {m.kind === "audio" && (
                  <div className="rf-audio-badge">
                    <span className="rf-audio-icon">🎙</span>
                    <span className="rf-audio-name">{m.file.name.length > 18 ? m.file.name.slice(0, 15) + "…" : m.file.name}</span>
                  </div>
                )}
                <button type="button" className="rf-media-remove" onClick={() => removeMedia(i)} aria-label="Remove">×</button>
                <span className="rf-media-badge">{m.kind}</span>
              </div>
            ))}
          </div>
        )}

        {/* Upload buttons */}
        <div className="rf-upload-row">
          {photoCount < MAX_PHOTOS && (
            <label className="rf-upload-btn">
              <input
                ref={photoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handlePhotoChange}
                hidden
              />
              <span className="rf-upload-icon">📷</span>
              Photo{photoCount > 0 ? ` (${photoCount}/${MAX_PHOTOS})` : ""}
            </label>
          )}
          {!hasVideo && (
            <label className="rf-upload-btn">
              <input
                ref={videoRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleVideoChange}
                hidden
              />
              <span className="rf-upload-icon">🎬</span>
              Video
            </label>
          )}
          {!hasAudio && (
            <label className="rf-upload-btn">
              <input
                ref={audioRef}
                type="file"
                accept="audio/mpeg,audio/mp4,audio/webm,audio/ogg,audio/wav"
                onChange={handleAudioChange}
                hidden
              />
              <span className="rf-upload-icon">🎙</span>
              Voice Note
            </label>
          )}
        </div>
        <p className="rf-media-limits">
          Photos: up to {MAX_PHOTOS} × {MAX_PHOTO_MB} MB · Video: 1 × {MAX_VIDEO_MB} MB · Audio: 1 × {MAX_AUDIO_MB} MB
        </p>
      </div>

      {error && <p className="rf-error">{error}</p>}

      <div className="rf-actions">
        <button type="submit" className="btn btn-gold" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit Review"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}
