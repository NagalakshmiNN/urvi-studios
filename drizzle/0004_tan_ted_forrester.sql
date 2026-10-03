ALTER TABLE "products" ADD COLUMN "piece_count" integer;
--> statement-breakpoint
-- Set piece_count = 3 for products in the "3-piece-set" category
UPDATE "products" SET "piece_count" = 3
WHERE "category_id" IN (SELECT "id" FROM "categories" WHERE "slug" = '3-piece-set');
--> statement-breakpoint
-- Set piece_count = 2 for products in "2-piece-set" or "co-ords" categories
UPDATE "products" SET "piece_count" = 2
WHERE "piece_count" IS NULL
  AND "category_id" IN (SELECT "id" FROM "categories" WHERE "slug" IN ('2-piece-set', 'co-ords'));
--> statement-breakpoint
-- Set piece_count = 3 for products whose name contains "3 piece" or "3-piece"
UPDATE "products" SET "piece_count" = 3
WHERE "piece_count" IS NULL
  AND (LOWER("name") LIKE '%3 piece%' OR LOWER("name") LIKE '%3-piece%');
--> statement-breakpoint
-- Set piece_count = 2 for products whose name contains "set", "co-ord", or "coord"
UPDATE "products" SET "piece_count" = 2
WHERE "piece_count" IS NULL
  AND (LOWER("name") LIKE '%set%' OR LOWER("name") LIKE '%co-ord%' OR LOWER("name") LIKE '%coord%');
--> statement-breakpoint
-- Everything else is 1 piece
UPDATE "products" SET "piece_count" = 1
WHERE "piece_count" IS NULL;
