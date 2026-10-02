-- Add "3 Piece Set" and "2 Piece Set" categories.
-- These cross-cut occasions — a 3-piece festive set and a 3-piece office set
-- both land here, so the parent is "Everyday" (the broadest bucket) and the
-- position places them after the existing seven categories.

INSERT INTO categories (id, slug, name, parent, position)
VALUES
  (gen_random_uuid(), '3-piece-set', '3 Piece Set', 'Everyday', 8),
  (gen_random_uuid(), '2-piece-set', '2 Piece Set', 'Everyday', 9)
ON CONFLICT (slug) DO NOTHING;
