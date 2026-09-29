-- Per-product markup overrides.
--
-- The Pricing screen sets markups by band — under ₹500 gets one target, ₹500–
-- 1,000 gets another. That is the right default, but the occasional product
-- needs its own number: a hero piece that earns its margin, a closeout that
-- needs to move, a gift set priced to a round figure.
--
-- Both columns are nullable. NULL means "use whatever the band says", which is
-- what every existing product does today, so adding this changes nothing by
-- itself. A non-null value overrides the band for that product only — until the
-- next "Apply to catalogue", which resets both back to NULL and re-prices from
-- the bands.

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "target_markup_pct" integer;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "min_markup_pct" integer;
