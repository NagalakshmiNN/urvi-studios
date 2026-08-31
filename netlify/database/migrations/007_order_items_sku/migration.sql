ALTER TABLE "order_items" ADD COLUMN "sku" text;

-- Backfill the Product ID onto past orders where the product still exists,
-- so historical orders also show it wherever possible.
UPDATE "order_items" oi
SET "sku" = p."sku"
FROM "products" p
WHERE oi."product_id" = p."id" AND oi."sku" IS NULL;
