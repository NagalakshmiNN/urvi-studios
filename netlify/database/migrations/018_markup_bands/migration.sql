-- What to charge, by what it cost to land.
--
-- The workbook prices each SKU from two numbers typed onto its row: a target
-- markup and a minimum markup, in columns Z and AA. Two hundred rows, two
-- numbers each, nearly all of them identical — which is a way of pretending a
-- ₹200 kurti and a ₹2,000 suit set are priced by the same rule.
--
-- They are not. So the markup comes from a band on landed cost instead, and
-- the bands live in a table rather than in code: a markup is a commercial
-- decision that changes with the season, the vendor and the competition, and a
-- decision that needs a deploy to change is a decision nobody revisits.
--
-- The four bands start at the workbook's existing 50% target and 30% floor, so
-- switching this on moves no price by itself. The Pricing screen shows what is
-- actually being charged in each band today, so the numbers that replace these
-- come from the real catalogue rather than from a guess.

CREATE TABLE IF NOT EXISTS "markup_bands" (
  "id" text PRIMARY KEY,
  "position" integer NOT NULL,
  -- Top of the band, in paise, inclusive. NULL on the last band: no ceiling,
  -- so every landed cost has a band and nothing is ever left unpriced.
  "up_to_paise" integer,
  "target_pct" integer NOT NULL,
  "min_pct" integer NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Guarded on emptiness rather than on each row: Netlify re-runs migrations on
-- every deploy, and a second pass must not reset bands she has since edited.
INSERT INTO "markup_bands" ("id", "position", "up_to_paise", "target_pct", "min_pct")
SELECT * FROM (VALUES
  (gen_random_uuid()::text, 0, 50000, 50, 30),
  (gen_random_uuid()::text, 1, 100000, 50, 30),
  (gen_random_uuid()::text, 2, 150000, 50, 30),
  (gen_random_uuid()::text, 3, NULL::integer, 50, 30)
) AS b(id, position, up_to_paise, target_pct, min_pct)
WHERE NOT EXISTS (SELECT 1 FROM "markup_bands");
