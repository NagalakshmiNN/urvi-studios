-- Add parent_tags and fabric_tags columns to products.
-- Both are pipe-separated text, e.g. "Everyday|Office" or "Cotton|Georgette".
-- Using DO blocks so the migration is safe to re-run if one column already exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'parent_tags'
  ) THEN
    ALTER TABLE products ADD COLUMN parent_tags text;
    -- Backfill from category parent
    UPDATE products p SET parent_tags = c.parent
    FROM categories c WHERE p.category_id = c.id AND c.parent IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'fabric_tags'
  ) THEN
    ALTER TABLE products ADD COLUMN fabric_tags text;
  END IF;
END $$;
