-- Costing reference data carried over from the product master Excel sheet
-- on each import: Landed Cost (GST + shipping), Minimum Round Up To, and
-- Maximum Round Up To. Admin-only display; Maximum Round Up To also drives
-- the product's live price on every import going forward.
ALTER TABLE "products" ADD COLUMN "landed_cost" integer;
ALTER TABLE "products" ADD COLUMN "min_round_up_to" integer;
ALTER TABLE "products" ADD COLUMN "max_round_up_to" integer;
