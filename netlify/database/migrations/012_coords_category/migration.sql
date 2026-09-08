-- Co-ords is a real category in the Product Master workbook (co-ord sets are
-- bought and costed as one piece), but the website had no home for them, so
-- imported co-ord rows were rejected as an unrecognised category.
--
-- Filed under the "Everyday" parent group alongside Casual Wear, Short Tops
-- and Kurta, since the nav only offers Everyday / Office / Occasion.
--
-- Guarded on slug so re-running this is harmless and it can't collide with a
-- Co-ords row the seed may already have created.
INSERT INTO "categories" ("id", "slug", "name", "parent", "position")
SELECT gen_random_uuid()::text, 'co-ords', 'Co-ords', 'Everyday', 7
WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'co-ords');
