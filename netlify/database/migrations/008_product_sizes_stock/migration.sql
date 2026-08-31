ALTER TABLE "product_sizes" ADD COLUMN "stock" integer NOT NULL DEFAULT 0;

-- Backfill: spread each product's existing single stock total evenly across
-- its sizes (remainder pieces go to the earliest sizes by position), so
-- nothing looks like it suddenly went to zero. From here on, product_sizes
-- is the source of truth and products.stock is kept as a synced total.
WITH ranked AS (
  SELECT
    ps."id",
    ROW_NUMBER() OVER (PARTITION BY ps."product_id" ORDER BY ps."position") AS rn,
    COUNT(*) OVER (PARTITION BY ps."product_id") AS n,
    p."stock" AS total_stock
  FROM "product_sizes" ps
  JOIN "products" p ON p."id" = ps."product_id"
)
UPDATE "product_sizes" ps
SET "stock" = (ranked.total_stock / ranked.n) + CASE WHEN ranked.rn <= (ranked.total_stock % ranked.n) THEN 1 ELSE 0 END
FROM ranked
WHERE ps."id" = ranked."id";

-- Re-sync each product's aggregate total to the (now real) sum of its
-- sizes, so it stays exactly consistent going forward.
UPDATE "products" p
SET "stock" = sub.total
FROM (
  SELECT "product_id", COALESCE(SUM("stock"), 0) AS total
  FROM "product_sizes"
  GROUP BY "product_id"
) sub
WHERE p."id" = sub."product_id";
