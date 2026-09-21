// The paperwork behind a purchase.
//
// The figures on a purchase were read off a piece of paper. Keeping that piece
// of paper beside them is what makes the record checkable a year later, when
// nobody remembers whether the freight was ₹360 or ₹380 — a question this very
// workbook has already raised twice.
//
// Rules only, no database. What may be uploaded, how big, and what a document
// is for.

/** What a document attached to a purchase actually is. */
export const DOCUMENT_KINDS = [
  "Invoice",
  "Transport bill",
  "Payment proof",
  "Packing list",
  "Other",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export function isDocumentKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value);
}

/**
 * What a vendor's paperwork actually arrives as: a PDF from a printer, or a
 * photograph taken on a phone. HEIC is on the list because iPhones produce it
 * by default and refusing it would mean half the invoices could not be filed —
 * browsers mostly cannot display it, so it is offered for download rather than
 * previewed, which is better than not having it at all.
 */
export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/heic": "HEIC",
  "image/heif": "HEIF",
};

/** Types a browser will render inline. The rest are download-only. */
const PREVIEWABLE = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export function canPreview(contentType: string): boolean {
  return PREVIEWABLE.has(contentType);
}

/**
 * 10MB. A phone photograph of an invoice is 2–5MB; a scanned multi-page PDF
 * can reach 8. The document is held as base64 text in Postgres, the same way
 * product photographs are, because a serverless function has no disk to write
 * to — base64 is a third larger again, so the ceiling is real, not nominal.
 */
export const MAX_BYTES = 10 * 1024 * 1024;

export type FileProblem = { message: string };

export function checkUpload(file: { name?: string; type?: string; size: number }): FileProblem | null {
  const name = file.name?.trim() || "That file";
  const type = (file.type || "").toLowerCase();

  if (file.size === 0) return { message: `${name} is empty.` };
  if (!ALLOWED_TYPES[type]) {
    return {
      message: `${name} is a ${type || "unknown"} file. Upload a PDF or a photo — ${Object.values(ALLOWED_TYPES).join(", ")}.`,
    };
  }
  if (file.size > MAX_BYTES) {
    return { message: `${name} is ${humanSize(file.size)}. The limit is ${humanSize(MAX_BYTES)} — photograph it at a lower resolution, or split a long PDF.` };
  }
  return null;
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A filename safe to put in a Content-Disposition header and in a table.
 *
 * Strips directory separators and control characters — a name is decoration
 * here, not a path, and a quote or a newline in one is how a header gets
 * split. Keeps the extension so a downloaded file still opens.
 */
export function safeFilename(raw: string | undefined | null): string {
  const base = (raw ?? "").replace(/[\\/]/g, " ").replace(/[\u0000-\u001f"]/g, "").trim();
  const trimmed = base.slice(0, 120);
  return trimmed || "document";
}
