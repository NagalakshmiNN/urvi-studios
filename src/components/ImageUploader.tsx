"use client";

import { useRef, useState } from "react";

export default function ImageUploader({ name, defaultUrls = [] }: { name: string; defaultUrls?: string[] }) {
  const [urls, setUrls] = useState<string[]>(defaultUrls);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      for (const f of list) body.append("files", f);
      const res = await fetch("/api/admin/upload-image", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed. Please try again.");
        return;
      }
      setUrls((prev) => [...prev, ...data.urls]);
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  function removeAt(i: number) {
    setUrls((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <input type="hidden" name={name} value={urls.join("\n")} />

      <div
        className={`image-dropzone${dragOver ? " over" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="dropzone-label">
          {uploading ? "Uploading…" : "Drag photos here, or click to choose files"}
        </p>
        <p className="dropzone-hint">JPG, PNG, WEBP or GIF, up to 8MB each. First photo shown becomes the main image.</p>
      </div>

      {error && <div className="notice-box error" style={{ marginTop: 10 }}>{error}</div>}

      {urls.length > 0 && (
        <div className="image-preview-row">
          {urls.map((url, i) => (
            <div key={url + i} className="image-preview-thumb">
              <img src={url} alt={`Photo ${i + 1}`} />
              {i === 0 && <span className="image-preview-primary">Main</span>}
              <button type="button" onClick={() => removeAt(i)} aria-label="Remove photo">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
