ALTER TABLE "orders" ADD COLUMN "sale_by" text;--> statement-breakpoint
-- Backfill: website orders default to "Website"
UPDATE "orders" SET "sale_by" = 'Website' WHERE "source" = 'online' AND "sale_by" IS NULL;
