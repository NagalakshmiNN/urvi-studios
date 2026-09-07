-- order_items already stores a full snapshot of the line (product name,
-- SKU, size, color, qty, price) independent of the live product row, so
-- deleting a product doesn't lose any order history — it only needs to
-- clear the now-dangling reference instead of blocking the delete.
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_products_id_fk";--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
