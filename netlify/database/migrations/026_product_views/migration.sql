-- Track approximate daily view counts per product for social proof
-- ("X people viewed this today").
CREATE TABLE IF NOT EXISTS product_views (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  view_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (product_id, viewed_on)
);

CREATE INDEX IF NOT EXISTS idx_product_views_date ON product_views (viewed_on);
