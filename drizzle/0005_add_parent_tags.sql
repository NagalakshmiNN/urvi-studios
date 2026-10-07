ALTER TABLE "products" ADD COLUMN "parent_tags" text;--> statement-breakpoint
-- Backfill: set parent_tags from each product's category's parent
UPDATE "products" p
SET "parent_tags" = c."parent"
FROM "categories" c
WHERE p."category_id" = c."id"
  AND c."parent" IS NOT NULL;
