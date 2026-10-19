CREATE TABLE IF NOT EXISTS "review_media" (
  "id" text PRIMARY KEY NOT NULL,
  "review_id" text NOT NULL REFERENCES "reviews"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "asset_id" text NOT NULL REFERENCES "product_image_assets"("id"),
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);
