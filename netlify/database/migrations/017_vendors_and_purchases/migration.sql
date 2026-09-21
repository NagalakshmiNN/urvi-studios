-- Where stock comes from, and what it cost to get here.
--
-- This is the costing workbook's VENDOR MASTER and PROCUREMENT REGISTER,
-- moved into the app. Until now an invoice was typed into a spreadsheet, which
-- worked out landed cost and a selling price, which were then carried across
-- to the website in a hand-built import file. That file was the only join
-- between the two systems, and it overwrote stock the website had already sold
-- down — so a re-sync quietly put sold pieces back on the shelf.
--
-- With purchases recorded here, an invoice is entered once and everything
-- follows from it: landed cost per piece, stock received, the price the band
-- rules suggest, and the Stock-purchase payment on the Money Map.
--
-- Amounts are in PAISE, as integers, like capital and expenses: a vendor's
-- unit price is ₹212.50 as often as it is ₹212, and floating point cannot hold
-- two decimal places exactly.
--
-- Every allocated figure (discount share, GST, freight share) is STORED on the
-- line rather than recomputed on read. A purchase is a ledger entry — it is
-- what the invoice said. Re-deriving these from today's code would silently
-- rewrite last quarter's costs the first time a rounding rule changed.

CREATE TABLE IF NOT EXISTS "vendors" (
  "id" text PRIMARY KEY,
  -- V001, V002 — the workbook's own numbering, continued.
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "business_name" text,
  "city" text,
  "state" text,
  "gstin" text,
  "pan" text,
  "type" text,
  "contact_person" text,
  "phone" text,
  "payment_terms" text,
  "notes" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "purchases" (
  "id" text PRIMARY KEY,
  -- PO-00006 onward, continuing the workbook's sequence.
  "ref" text NOT NULL UNIQUE,
  "vendor_id" text NOT NULL REFERENCES "vendors"("id"),
  "invoice_number" text NOT NULL,
  "invoice_date" date NOT NULL,
  "freight_paise" integer NOT NULL DEFAULT 0,
  "discount_paise" integer NOT NULL DEFAULT 0,
  "other_charges_paise" integer NOT NULL DEFAULT 0,
  "gross_paise" integer NOT NULL,
  "taxable_paise" integer NOT NULL,
  "gst_paise" integer NOT NULL,
  -- Taxable + GST + freight + other: what the stock cost to get onto the rail.
  "landed_total_paise" integer NOT NULL,
  "total_qty" integer NOT NULL,
  "payment_mode" text,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "purchase_lines" (
  "id" text PRIMARY KEY,
  "purchase_id" text NOT NULL REFERENCES "purchases"("id") ON DELETE CASCADE,
  -- Null once a product is deleted. The purchase stays a true record of what
  -- was bought even when the catalogue moves on.
  "product_id" text REFERENCES "products"("id") ON DELETE SET NULL,
  -- As the invoice named it, kept verbatim even if the product is renamed later.
  "item" text NOT NULL,
  "colour" text,
  "size" text NOT NULL,
  "qty" integer NOT NULL,
  "unit_price_paise" integer NOT NULL,
  "gst_rate_pct" integer NOT NULL,
  "discount_share_paise" integer NOT NULL DEFAULT 0,
  "gst_paise" integer NOT NULL DEFAULT 0,
  "freight_share_paise" integer NOT NULL DEFAULT 0,
  "other_share_paise" integer NOT NULL DEFAULT 0,
  "landed_paise" integer NOT NULL,
  "landed_per_unit_paise" integer NOT NULL,
  "position" integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "purchase_lines_purchase_idx" ON "purchase_lines" ("purchase_id");
CREATE INDEX IF NOT EXISTS "purchase_lines_product_idx" ON "purchase_lines" ("product_id");
CREATE INDEX IF NOT EXISTS "purchases_vendor_idx" ON "purchases" ("vendor_id");
CREATE INDEX IF NOT EXISTS "purchases_invoice_date_idx" ON "purchases" ("invoice_date");

-- The four vendors already in the workbook, so the first invoice entered here
-- finds its supplier rather than creating a second copy of it. Guarded on code
-- because Netlify re-runs migrations on every deploy.
INSERT INTO "vendors" ("id", "code", "name", "city", "state", "gstin", "pan", "type")
SELECT * FROM (VALUES
  (gen_random_uuid()::text, 'V001', 'Bijalee Kurtis', 'Ahmedabad', 'Gujarat', '24AWEPS7851F1ZB', 'AWEPS7851F', 'Wholesaler'),
  (gen_random_uuid()::text, 'V002', 'Jinaaya / Vivaanta Fashions', 'Surat', 'Gujarat', '24AGDPJ2791G1ZJ', 'AGDPJ2791G', 'Wholesaler'),
  (gen_random_uuid()::text, 'V003', 'Iccha By Prime', 'Bangalore', 'Karnataka', '29AAJFI6322E1ZE', 'AAJFI6322E', 'Wholesaler'),
  (gen_random_uuid()::text, 'V004', 'G.D. Fabrics', 'Jaipur', 'Rajasthan', '08ABXPA3166H1ZF', 'ABXPA3166H', 'Manufacturer')
) AS v(id, code, name, city, state, gstin, pan, type)
WHERE NOT EXISTS (SELECT 1 FROM "vendors" WHERE "vendors"."code" = v.code);

-- Purchase numbering continues from the workbook, which reached PO-00005.
INSERT INTO "counters" ("key", "value")
SELECT 'purchases', 5
WHERE NOT EXISTS (SELECT 1 FROM "counters" WHERE "key" = 'purchases');
