-- The paperwork behind a purchase.
--
-- The figures on a purchase were read off a piece of paper, usually a photo of
-- one taken on a phone. Keeping that paper beside the figures is what makes the
-- record checkable a year later — when nobody remembers whether PO-00002's
-- freight was ₹360 or ₹380, which is a real open question on this very ledger.
--
-- Stored as base64 text in Postgres, the same way product photographs are: a
-- Netlify function has no disk to write to. Served only through an
-- admin-authenticated route, never the public /api/images path — a vendor
-- invoice shows what the business pays for its stock.
--
-- DELETED SOFTLY. deleted_at null means in use; set means removed but
-- recoverable. Paperwork deleted by mistake is paperwork that may be wanted at
-- the end of the financial year, and keeping a row costs nothing next to an
-- invoice that cannot be got back.

CREATE TABLE IF NOT EXISTS "purchase_documents" (
  "id" text PRIMARY KEY,
  "purchase_id" text NOT NULL REFERENCES "purchases"("id") ON DELETE CASCADE,
  "kind" text NOT NULL DEFAULT 'Invoice',
  "filename" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "data_base64" text NOT NULL,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp,
  "deleted_reason" text
);

-- Every listing filters to the live documents for one purchase, so index that
-- pair rather than the purchase alone.
CREATE INDEX IF NOT EXISTS "purchase_documents_purchase_idx"
  ON "purchase_documents" ("purchase_id", "deleted_at");
