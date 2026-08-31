CREATE TABLE "product_image_assets" (
  "id" text PRIMARY KEY NOT NULL,
  "content_type" text NOT NULL,
  "data_base64" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
