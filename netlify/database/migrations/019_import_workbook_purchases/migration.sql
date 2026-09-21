-- The five purchases already made, brought in from the costing workbook.
--
-- Vendors came across in migration 017 but their history did not, so the
-- Purchases and Vendors screens opened empty on a business that has bought
-- ₹144,188 of stock across 195 pieces. This is that history: every line of
-- every invoice, with the quantity received, the unit price, the GST, and the
-- share of freight the workbook allocated to it.
--
-- The figures are the workbook's own computed values rather than a fresh
-- calculation. The two must agree while both exist, and the surest way to
-- agree with a spreadsheet is to use its arithmetic rather than reproduce it.
--
-- TWO THINGS THIS DELIBERATELY DOES NOT DO
--
-- It does not touch stock. The app's per-size stock has been sold down since
-- these invoices; the register only ever records what was RECEIVED. Writing
-- that over the top would restore sold pieces — the exact bug this round
-- exists to fix.
--
-- It does not re-create the money for PO-00001 to PO-00004. Migration 016
-- already imported those from the Payment Tracker (₹94,888 of stock, ₹2,387 of
-- freight). A second copy would show every rupee spent twice. Only G.D.
-- Fabrics' GD707 is added below: it reached the workbook on 15 September, a day
-- after that import was written, and has been missing from the Money Map ever
-- since — ₹46,433 of stock and ₹500 of freight.
--
-- Guarded on PO-00001 existing, because Netlify re-runs migrations on deploy.

DO $backfill$
DECLARE
  v001 text; v002 text; v003 text; v004 text;
BEGIN
  IF EXISTS (SELECT 1 FROM purchases WHERE ref = 'PO-00001') THEN
    RAISE NOTICE 'Purchase history already imported — nothing to do.';
    RETURN;
  END IF;

  SELECT id INTO v001 FROM vendors WHERE code = 'V001';
  SELECT id INTO v002 FROM vendors WHERE code = 'V002';
  SELECT id INTO v003 FROM vendors WHERE code = 'V003';
  SELECT id INTO v004 FROM vendors WHERE code = 'V004';

  IF v001 IS NULL OR v002 IS NULL OR v003 IS NULL OR v004 IS NULL THEN
    RAISE EXCEPTION 'Vendors V001–V004 are missing; migration 017 must run first.';
  END IF;

  -- PO-00001 · invoice 2026-27/101 · 27 lines · 27 pieces · ₹29,978.55 landed
  INSERT INTO purchases (id, ref, vendor_id, invoice_number, invoice_date,
    freight_paise, discount_paise, other_charges_paise,
    gross_paise, taxable_paise, gst_paise, landed_total_paise, total_qty,
    payment_mode, notes)
  VALUES (gen_random_uuid()::text, 'PO-00001', v001, '2026-27/101', DATE '2026-08-20',
    56700, 0, 0, 2801100, 2801100, 140055, 2997855, 27,
    'UPI', 'Imported from the costing workbook''s Procurement Register');
  INSERT INTO purchase_lines (id, purchase_id, item, colour, size, qty, unit_price_paise,
    gst_rate_pct, discount_share_paise, gst_paise, freight_share_paise, other_share_paise,
    landed_paise, landed_per_unit_paise, position)
  VALUES
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), 'Collar Kurti', 'White', 'L', 1, 42500, 5, 0, 2125, 2100, 0, 46725, 46725, 0),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), 'Collar Kurti', 'White', 'XL', 1, 42500, 5, 0, 2125, 2100, 0, 46725, 46725, 1),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), 'Collar Kurti', 'White', 'XXL', 1, 42500, 5, 0, 2125, 2100, 0, 46725, 46725, 2),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), 'Collar Kurti', 'White', '3XL', 1, 42500, 5, 0, 2125, 2100, 0, 46725, 46725, 3),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), 'Collar Kurti', 'White', '4XL', 1, 42500, 5, 0, 2125, 2100, 0, 46725, 46725, 4),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Salsa Kurti Set', 'Pink', 'M', 1, 134500, 5, 0, 6725, 2100, 0, 143325, 143325, 5),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Salsa Kurti Set', 'Pink', 'L', 1, 134500, 5, 0, 6725, 2100, 0, 143325, 143325, 6),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Salsa Kurti Set', 'Pink', 'XL', 1, 134500, 5, 0, 6725, 2100, 0, 143325, 143325, 7),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Salsa Kurti Set', 'Pink', 'XXL', 1, 134500, 5, 0, 6725, 2100, 0, 143325, 143325, 8),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Salsa Kurti Set', 'Beige', 'M', 1, 134500, 5, 0, 6725, 2100, 0, 143325, 143325, 9),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Salsa Kurti Set', 'Beige', 'L', 1, 134500, 5, 0, 6725, 2100, 0, 143325, 143325, 10),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Salsa Kurti Set', 'Beige', 'XL', 1, 134500, 5, 0, 6725, 2100, 0, 143325, 143325, 11),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Salsa Kurti Set', 'Beige', 'XXL', 1, 134500, 5, 0, 6725, 2100, 0, 143325, 143325, 12),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Kurti Set - Mustard', 'Mustard', 'M', 1, 108000, 5, 0, 5400, 2100, 0, 115500, 115500, 13),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Kurti Set - Mustard', 'Mustard', 'L', 1, 108000, 5, 0, 5400, 2100, 0, 115500, 115500, 14),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Kurti Set - Mustard', 'Mustard', 'XL', 1, 108000, 5, 0, 5400, 2100, 0, 115500, 115500, 15),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Kurti Set - Mustard', 'Mustard', 'XXL', 1, 108000, 5, 0, 5400, 2100, 0, 115500, 115500, 16),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), 'Crunchy Kurti', 'Olive', 'L', 1, 108100, 5, 0, 5405, 2100, 0, 115605, 115605, 17),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), 'Crunchy Kurti', 'Olive', 'XL', 1, 108100, 5, 0, 5405, 2100, 0, 115605, 115605, 18),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), 'Crunchy Kurti', 'Olive', 'XXL', 1, 108100, 5, 0, 5405, 2100, 0, 115605, 115605, 19),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Kurti Set - Mehndi', 'Green', 'M', 1, 108000, 5, 0, 5400, 2100, 0, 115500, 115500, 20),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Kurti Set - Mehndi', 'Green', 'L', 1, 108000, 5, 0, 5400, 2100, 0, 115500, 115500, 21),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Kurti Set - Mehndi', 'Green', 'XL', 1, 108000, 5, 0, 5400, 2100, 0, 115500, 115500, 22),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), '3Pc Kurti Set - Mehndi', 'Green', 'XXL', 1, 108000, 5, 0, 5400, 2100, 0, 115500, 115500, 23),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), 'Crunchy Kurti', 'Pink', 'L', 1, 108100, 5, 0, 5405, 2100, 0, 115605, 115605, 24),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), 'Crunchy Kurti', 'Pink', 'XL', 1, 108100, 5, 0, 5405, 2100, 0, 115605, 115605, 25),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00001'), 'Crunchy Kurti', 'Pink', 'XXL', 1, 108100, 5, 0, 5405, 2100, 0, 115605, 115605, 26);

  -- PO-00002 · invoice 2026-27/108 · 18 lines · 18 pieces · ₹15,030.60 landed
  INSERT INTO purchases (id, ref, vendor_id, invoice_number, invoice_date,
    freight_paise, discount_paise, other_charges_paise,
    gross_paise, taxable_paise, gst_paise, landed_total_paise, total_qty,
    payment_mode, notes)
  VALUES (gen_random_uuid()::text, 'PO-00002', v001, '2026-27/108', DATE '2026-08-26',
    36000, 0, 0, 1397200, 1397200, 69860, 1503060, 18,
    'UPI', 'Imported from the costing workbook''s Procurement Register');
  INSERT INTO purchase_lines (id, purchase_id, item, colour, size, qty, unit_price_paise,
    gst_rate_pct, discount_share_paise, gst_paise, freight_share_paise, other_share_paise,
    landed_paise, landed_per_unit_paise, position)
  VALUES
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Bhumi Kurti', 'Blue', 'L', 1, 132000, 5, 0, 6600, 2000, 0, 140600, 140600, 0),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Bhumi Kurti', 'Blue', 'XL', 1, 132000, 5, 0, 6600, 2000, 0, 140600, 140600, 1),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Bhumi Kurti', 'Green', 'L', 1, 132000, 5, 0, 6600, 2000, 0, 140600, 140600, 2),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Bhumi Kurti', 'Green', 'XL', 1, 132000, 5, 0, 6600, 2000, 0, 140600, 140600, 3),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Bhumi Kurti', 'Pink', 'L', 1, 132000, 5, 0, 6600, 2000, 0, 140600, 140600, 4),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Bhumi Kurti', 'Pink', 'XL', 1, 132000, 5, 0, 6600, 2000, 0, 140600, 140600, 5),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Sonam Kurti', 'White', 'L', 1, 159600, 5, 0, 7980, 2000, 0, 169580, 169580, 6),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Sonam Kurti', 'White', 'XL', 1, 159600, 5, 0, 7980, 2000, 0, 169580, 169580, 7),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Short Kurti - Flower Print', NULL, 'M', 1, 28600, 5, 0, 1430, 2000, 0, 32030, 32030, 8),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Short Kurti - Flower Print', NULL, 'L', 1, 28600, 5, 0, 1430, 2000, 0, 32030, 32030, 9),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Short Kurti - Flower Print', NULL, 'XL', 1, 28600, 5, 0, 1430, 2000, 0, 32030, 32030, 10),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Short Kurti - Flower Print', NULL, 'XXL', 1, 28600, 5, 0, 1430, 2000, 0, 32030, 32030, 11),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Short Kurti - Flower Print', NULL, '3XL', 1, 28600, 5, 0, 1430, 2000, 0, 32030, 32030, 12),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Short Kurti - Toker Print', NULL, 'M', 1, 28600, 5, 0, 1430, 2000, 0, 32030, 32030, 13),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Short Kurti - Toker Print', NULL, 'L', 1, 28600, 5, 0, 1430, 2000, 0, 32030, 32030, 14),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Short Kurti - Toker Print', NULL, 'XL', 1, 28600, 5, 0, 1430, 2000, 0, 32030, 32030, 15),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Short Kurti - Toker Print', NULL, 'XXL', 1, 28600, 5, 0, 1430, 2000, 0, 32030, 32030, 16),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00002'), 'Short Kurti - Toker Print', NULL, '3XL', 1, 28600, 5, 0, 1430, 2000, 0, 32030, 32030, 17);

  -- PO-00003 · invoice B2C182/26-27 · 32 lines · 33 pieces · ₹24,654.15 landed
  INSERT INTO purchases (id, ref, vendor_id, invoice_number, invoice_date,
    freight_paise, discount_paise, other_charges_paise,
    gross_paise, taxable_paise, gst_paise, landed_total_paise, total_qty,
    payment_mode, notes)
  VALUES (gen_random_uuid()::text, 'PO-00003', v002, 'B2C182/26-27', DATE '2026-08-31',
    116986, 0, 0, 2236600, 2236600, 111829, 2465415, 33,
    'UPI', 'Imported from the costing workbook''s Procurement Register');
  INSERT INTO purchase_lines (id, purchase_id, item, colour, size, qty, unit_price_paise,
    gst_rate_pct, discount_share_paise, gst_paise, freight_share_paise, other_share_paise,
    landed_paise, landed_per_unit_paise, position)
  VALUES
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Yellow Poly Chanderi Solid Straight Suit Set', NULL, 'L', 1, 39900, 5, 0, 1995, 3545, 0, 45440, 45440, 0),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Blue Poly Chanderi Solid Straight Suit Set', NULL, 'XXL', 1, 39900, 5, 0, 1995, 3545, 0, 45440, 45440, 1),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Blue Silk Blend Solid Yoke Design Straight Suit Set', NULL, 'XXL', 2, 169900, 5, 0, 16990, 7091, 0, 363881, 181940, 2),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Green Silk Blend Solid Yoke Design Flared Empire Suit Set', NULL, 'L', 1, 69900, 5, 0, 3495, 3545, 0, 76940, 76940, 3),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Green Silk Blend Solid Yoke Design Flared Empire Suit Set', NULL, 'XXL', 1, 69900, 5, 0, 3495, 3545, 0, 76940, 76940, 4),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Green Silk Blend Solid Yoke Design Flared Empire Suit Set', NULL, 'XL', 1, 69900, 5, 0, 3495, 3545, 0, 76940, 76940, 5),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Lavender Silk Blend Solid Embroidered Straight Suit Set', NULL, 'L', 1, 94850, 5, 0, 4742, 3545, 0, 103137, 103137, 6),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Lavender Silk Blend Solid Embroidered Straight Suit Set', NULL, 'XL', 1, 94850, 5, 0, 4742, 3545, 0, 103137, 103137, 7),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Lavender Silk Blend Solid Embroidered Straight Suit Set', NULL, 'XXL', 1, 94850, 5, 0, 4742, 3545, 0, 103137, 103137, 8),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Pink Silk Blend Embroidered Straight Suit Set', NULL, 'XXL', 1, 69900, 5, 0, 3495, 3545, 0, 76940, 76940, 9),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Pink Silk Blend Embroidered Straight Suit Set', NULL, '3XL', 1, 69900, 5, 0, 3495, 3545, 0, 76940, 76940, 10),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Navy Blue Silk Blend Solid Embroidered Straight Suit Set With Trouser Style Bottom', NULL, 'XXL', 1, 59900, 5, 0, 2995, 3545, 0, 66440, 66440, 11),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Navy Blue Silk Blend Solid Embroidered Straight Suit Set With Trouser Style Bottom', NULL, 'XL', 1, 59900, 5, 0, 2995, 3545, 0, 66440, 66440, 12),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Pink Printed Fancy Daily Wear Kurti', NULL, 'L', 1, 24950, 5, 0, 1248, 3545, 0, 29743, 29743, 13),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Pink Printed Fancy Daily Wear Kurti', NULL, 'M', 1, 24950, 5, 0, 1248, 3545, 0, 29743, 29743, 14),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Pink Printed Fancy Daily Wear Kurti', NULL, 'S', 1, 24950, 5, 0, 1248, 3545, 0, 29743, 29743, 15),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Pink Printed Fancy Daily Wear Kurti', NULL, 'XXL', 1, 24950, 5, 0, 1248, 3545, 0, 29743, 29743, 16),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Pink Printed Fancy Daily Wear Kurti', NULL, 'XL', 1, 24950, 5, 0, 1248, 3545, 0, 29743, 29743, 17),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Off White Cotton Anarkali Kurti', NULL, 'XXL', 1, 49900, 5, 0, 2495, 3545, 0, 55940, 55940, 18),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Off White Cotton Anarkali Kurti', NULL, 'M', 1, 49900, 5, 0, 2495, 3545, 0, 55940, 55940, 19),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Off White Cotton Anarkali Kurti', NULL, 'S', 1, 49900, 5, 0, 2495, 3545, 0, 55940, 55940, 20),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Mustard Silk Blend Flared Kurta With Dupatta', NULL, 'XXL', 1, 99900, 5, 0, 4995, 3545, 0, 108440, 108440, 21),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Mustard Silk Blend Flared Kurta With Dupatta', NULL, 'M', 1, 99900, 5, 0, 4995, 3545, 0, 108440, 108440, 22),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Mustard Silk Blend Flared Kurta With Dupatta', NULL, 'L', 1, 99900, 5, 0, 4995, 3545, 0, 108440, 108440, 23),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Rayon Black Floral Digital Printed Regular Kurta', NULL, 'M', 1, 34900, 5, 0, 1745, 3545, 0, 40190, 40190, 24),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Rayon Black Floral Digital Printed Regular Kurta', NULL, 'L', 1, 34850, 5, 0, 1742, 3545, 0, 40137, 40137, 25),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Rayon Black Floral Digital Printed Regular Kurta', NULL, 'S', 1, 34900, 5, 0, 1745, 3545, 0, 40190, 40190, 26),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Rayon Black Floral Digital Printed Regular Kurta', NULL, 'XXL', 1, 34900, 5, 0, 1745, 3545, 0, 40190, 40190, 27),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Rayon Black Floral Digital Printed Regular Kurta', NULL, 'XL', 1, 34900, 5, 0, 1745, 3545, 0, 40190, 40190, 28),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Light Yellow Embroidered Viscose Rayon Straight Trouser Bottom Kurta Set', NULL, 'L', 1, 104850, 5, 0, 5242, 3545, 0, 113637, 113637, 29),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Light Yellow Embroidered Viscose Rayon Straight Trouser Bottom Kurta Set', NULL, 'XXL', 1, 104850, 5, 0, 5242, 3545, 0, 113637, 113637, 30),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00003'), 'Light Yellow Embroidered Viscose Rayon Straight Trouser Bottom Kurta Set', NULL, 'XL', 1, 104850, 5, 0, 5242, 3545, 0, 113637, 113637, 31);

  -- PO-00004 · invoice IBPW-26/27-350 · 32 lines · 32 pieces · ₹27,570.92 landed
  INSERT INTO purchases (id, ref, vendor_id, invoice_number, invoice_date,
    freight_paise, discount_paise, other_charges_paise,
    gross_paise, taxable_paise, gst_paise, landed_total_paise, total_qty,
    payment_mode, notes)
  VALUES (gen_random_uuid()::text, 'PO-00004', v003, 'IBPW-26/27-350', DATE '2026-09-07',
    24992, 0, 0, 2602000, 2602000, 130100, 2757092, 32,
    'Bank transfer', 'Imported from the costing workbook''s Procurement Register');
  INSERT INTO purchase_lines (id, purchase_id, item, colour, size, qty, unit_price_paise,
    gst_rate_pct, discount_share_paise, gst_paise, freight_share_paise, other_share_paise,
    landed_paise, landed_per_unit_paise, position)
  VALUES
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Indigo Dabu Print Short Kurti', 'Blue', 'S', 1, 40000, 5, 0, 2000, 781, 0, 42781, 42781, 0),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Indigo Dabu Print Short Kurti', 'Blue', 'M', 1, 40000, 5, 0, 2000, 781, 0, 42781, 42781, 1),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Indigo Dabu Print Short Kurti', 'Blue', 'L', 1, 40000, 5, 0, 2000, 781, 0, 42781, 42781, 2),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Indigo Dabu Print Short Kurti', 'Blue', 'XL', 1, 40000, 5, 0, 2000, 781, 0, 42781, 42781, 3),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Indigo Dabu Print Short Kurti', 'Blue', 'XXL', 1, 40000, 5, 0, 2000, 781, 0, 42781, 42781, 4),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Mint Green V-Neck Dobby Weaving Handloom Set', 'Green', 'S', 1, 90000, 5, 0, 4500, 781, 0, 95281, 95281, 5),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Mint Green V-Neck Dobby Weaving Handloom Set', 'Green', 'M', 1, 90000, 5, 0, 4500, 781, 0, 95281, 95281, 6),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Mint Green V-Neck Dobby Weaving Handloom Set', 'Green', 'L', 1, 90000, 5, 0, 4500, 781, 0, 95281, 95281, 7),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Mint Green V-Neck Dobby Weaving Handloom Set', 'Green', 'XL', 1, 90000, 5, 0, 4500, 781, 0, 95281, 95281, 8),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Grey V-Neck Dobby Weaving Handloom Set', 'Grey', 'M', 1, 90000, 5, 0, 4500, 781, 0, 95281, 95281, 9),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Grey V-Neck Dobby Weaving Handloom Set', 'Grey', 'L', 1, 90000, 5, 0, 4500, 781, 0, 95281, 95281, 10),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Grey V-Neck Dobby Weaving Handloom Set', 'Grey', 'XL', 1, 90000, 5, 0, 4500, 781, 0, 95281, 95281, 11),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Grey V-Neck Dobby Weaving Handloom Set', 'Grey', 'XXL', 1, 90000, 5, 0, 4500, 781, 0, 95281, 95281, 12),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Peach Printed Imported Co-ord Set', 'Peach', 'S', 1, 111000, 5, 0, 5550, 781, 0, 117331, 117331, 13),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Peach Printed Imported Co-ord Set', 'Peach', 'M', 1, 111000, 5, 0, 5550, 781, 0, 117331, 117331, 14),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Peach Printed Imported Co-ord Set', 'Peach', 'L', 1, 111000, 5, 0, 5550, 781, 0, 117331, 117331, 15),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Peach Printed Imported Co-ord Set', 'Peach', 'XL', 1, 111000, 5, 0, 5550, 781, 0, 117331, 117331, 16),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Peach Printed Imported Co-ord Set', 'Peach', 'XXL', 1, 111000, 5, 0, 5550, 781, 0, 117331, 117331, 17),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Cream Floral Print Muslin Co-ord Set', 'Cream', 'M', 1, 108000, 5, 0, 5400, 781, 0, 114181, 114181, 18),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Cream Floral Print Muslin Co-ord Set', 'Cream', 'L', 1, 108000, 5, 0, 5400, 781, 0, 114181, 114181, 19),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Cream Floral Print Muslin Co-ord Set', 'Cream', 'XL', 1, 108000, 5, 0, 5400, 781, 0, 114181, 114181, 20),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Cream Floral Print Muslin Co-ord Set', 'Cream', 'XXL', 1, 108000, 5, 0, 5400, 781, 0, 114181, 114181, 21),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Black Fly Print Cotton Kurti', 'Black', 'S', 1, 55000, 5, 0, 2750, 781, 0, 58531, 58531, 22),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Black Fly Print Cotton Kurti', 'Black', 'M', 1, 55000, 5, 0, 2750, 781, 0, 58531, 58531, 23),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Black Fly Print Cotton Kurti', 'Black', 'L', 1, 55000, 5, 0, 2750, 781, 0, 58531, 58531, 24),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Black Fly Print Cotton Kurti', 'Black', 'XL', 1, 55000, 5, 0, 2750, 781, 0, 58531, 58531, 25),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Black Fly Print Cotton Kurti', 'Black', 'XXL', 1, 55000, 5, 0, 2750, 781, 0, 58531, 58531, 26),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Blue Stripes Mirror Work Handloom Kurti', 'Blue', 'S', 1, 84000, 5, 0, 4200, 781, 0, 88981, 88981, 27),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Blue Stripes Mirror Work Handloom Kurti', 'Blue', 'M', 1, 84000, 5, 0, 4200, 781, 0, 88981, 88981, 28),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Blue Stripes Mirror Work Handloom Kurti', 'Blue', 'L', 1, 84000, 5, 0, 4200, 781, 0, 88981, 88981, 29),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Blue Stripes Mirror Work Handloom Kurti', 'Blue', 'XL', 1, 84000, 5, 0, 4200, 781, 0, 88981, 88981, 30),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00004'), 'Blue Stripes Mirror Work Handloom Kurti', 'Blue', 'XXL', 1, 84000, 5, 0, 4200, 781, 0, 88981, 88981, 31);

  -- PO-00005 · invoice GD707 · 85 lines · 85 pieces · ₹46,932.83 landed
  INSERT INTO purchases (id, ref, vendor_id, invoice_number, invoice_date,
    freight_paise, discount_paise, other_charges_paise,
    gross_paise, taxable_paise, gst_paise, landed_total_paise, total_qty,
    payment_mode, notes)
  VALUES (gen_random_uuid()::text, 'PO-00005', v004, 'GD707', DATE '2026-09-07',
    49980, 107814, 0, 4530000, 4422186, 221117, 4693283, 85,
    'UPI', 'Imported from the costing workbook''s Procurement Register');
  INSERT INTO purchase_lines (id, purchase_id, item, colour, size, qty, unit_price_paise,
    gst_rate_pct, discount_share_paise, gst_paise, freight_share_paise, other_share_paise,
    landed_paise, landed_per_unit_paise, position)
  VALUES
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Short Kurthi', 'Red', 'S', 1, 15500, 5, 369, 757, 588, 0, 16476, 16476, 0),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Short Kurthi', 'Red', 'M', 1, 15500, 5, 369, 757, 588, 0, 16476, 16476, 1),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Short Kurthi', 'Red', 'L', 1, 15500, 5, 369, 757, 588, 0, 16476, 16476, 2),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Short Kurthi', 'Red', 'XL', 1, 15500, 5, 369, 757, 588, 0, 16476, 16476, 3),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Alia Short Top', NULL, 'XS', 1, 22000, 5, 524, 1074, 588, 0, 23138, 23138, 4),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Alia Short Top', NULL, 'S', 1, 22000, 5, 524, 1074, 588, 0, 23138, 23138, 5),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Alia Short Top', NULL, 'M', 1, 22000, 5, 524, 1074, 588, 0, 23138, 23138, 6),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Alia Short Top', NULL, 'L', 1, 22000, 5, 524, 1074, 588, 0, 23138, 23138, 7),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Alia Short Top', NULL, 'XL', 1, 22000, 5, 524, 1074, 588, 0, 23138, 23138, 8),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Alia Short Top', NULL, 'XXL', 1, 22000, 5, 524, 1074, 588, 0, 23138, 23138, 9),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Laila Short Top with Back Lace Tie', NULL, 'XS', 1, 32000, 5, 762, 1562, 588, 0, 33388, 33388, 10),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Laila Short Top with Back Lace Tie', NULL, 'S', 1, 32000, 5, 762, 1562, 588, 0, 33388, 33388, 11),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Laila Short Top with Back Lace Tie', NULL, 'M', 1, 32000, 5, 762, 1562, 588, 0, 33388, 33388, 12),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Laila Short Top with Back Lace Tie', NULL, 'L', 1, 32000, 5, 762, 1562, 588, 0, 33388, 33388, 13),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Laila Short Top with Back Lace Tie', NULL, 'XL', 1, 32000, 5, 762, 1562, 588, 0, 33388, 33388, 14),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Laila Short Top with Back Lace Tie', NULL, 'XXL', 1, 32000, 5, 762, 1562, 588, 0, 33388, 33388, 15),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Regular Kurthas', 'Blue with Orange flower', 'M', 1, 26000, 5, 619, 1269, 588, 0, 27238, 27238, 16),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Regular Kurthas', 'Blue with Orange flower', 'L', 1, 26000, 5, 619, 1269, 588, 0, 27238, 27238, 17),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Regular Kurthas', 'Blue with Orange flower', 'XL', 1, 26000, 5, 619, 1269, 588, 0, 27238, 27238, 18),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Regular Kurthas', 'Mustard', 'M', 1, 26000, 5, 619, 1269, 588, 0, 27238, 27238, 19),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Premium Cotton Kurtha', NULL, 'L', 1, 76000, 5, 1809, 3710, 588, 0, 78489, 78489, 20),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Premium Cotton Kurtha', NULL, 'XL', 1, 76000, 5, 1809, 3710, 588, 0, 78489, 78489, 21),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Premium Cotton Kurtha', NULL, 'XXL', 1, 76000, 5, 1809, 3710, 588, 0, 78489, 78489, 22),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Premium Cotton Kurtha', NULL, '3XL', 1, 76000, 5, 1809, 3710, 588, 0, 78489, 78489, 23),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Floral Design Kurtha', NULL, 'M', 1, 110000, 5, 2618, 5369, 588, 0, 113339, 113339, 24),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Floral Design Kurtha', NULL, 'L', 1, 110000, 5, 2618, 5369, 588, 0, 113339, 113339, 25),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Floral Design Kurtha', NULL, 'XL', 1, 110000, 5, 2618, 5369, 588, 0, 113339, 113339, 26),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Floral Design Kurtha', NULL, 'XXL', 1, 110000, 5, 2618, 5369, 588, 0, 113339, 113339, 27),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Floral Design Kurtha', NULL, '3XL', 1, 110000, 5, 2618, 5369, 588, 0, 113339, 113339, 28),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Yolk Design Kurtha', 'Red', 'L', 1, 68500, 5, 1630, 3344, 588, 0, 70802, 70802, 29),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Yolk Design Kurtha', 'Red', 'XL', 1, 68500, 5, 1630, 3344, 588, 0, 70802, 70802, 30),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Yolk Design Kurtha', 'Red', 'XXL', 1, 68500, 5, 1630, 3344, 588, 0, 70802, 70802, 31),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Yolk Design Kurtha', 'Red', '3XL', 1, 68500, 5, 1630, 3344, 588, 0, 70802, 70802, 32),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Yolk Design Kurtha', 'Black', 'L', 1, 68500, 5, 1630, 3344, 588, 0, 70802, 70802, 33),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Yolk Design Kurtha', 'Black', 'XL', 1, 68500, 5, 1630, 3344, 588, 0, 70802, 70802, 34),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Yolk Design Kurtha', 'Black', 'XXL', 1, 68500, 5, 1630, 3344, 588, 0, 70802, 70802, 35),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Yolk Design Kurtha', 'Black', '3XL', 1, 68500, 5, 1630, 3344, 588, 0, 70802, 70802, 36),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Premium Bandhani 3-Piece Suit Set', NULL, 'M', 1, 64500, 5, 1535, 3148, 588, 0, 66701, 66701, 37),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Premium Bandhani 3-Piece Suit Set', NULL, 'L', 1, 64500, 5, 1535, 3148, 588, 0, 66701, 66701, 38),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Premium Bandhani 3-Piece Suit Set', NULL, 'XL', 1, 64500, 5, 1535, 3148, 588, 0, 66701, 66701, 39),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Premium Bandhani 3-Piece Suit Set', NULL, 'XXL', 1, 64500, 5, 1535, 3148, 588, 0, 66701, 66701, 40),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Light Brown Side Dori Kurtha', 'Light Brown', 'L', 1, 63000, 5, 1499, 3075, 588, 0, 65164, 65164, 41),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Light Brown Side Dori Kurtha', 'Light Brown', 'XL', 1, 63000, 5, 1499, 3075, 588, 0, 65164, 65164, 42),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Light Brown Side Dori Kurtha', 'Light Brown', 'XXL', 1, 63000, 5, 1499, 3075, 588, 0, 65164, 65164, 43),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Light Brown Side Dori Kurtha', 'Light Brown', '3XL', 1, 63000, 5, 1499, 3075, 588, 0, 65164, 65164, 44),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Kurtha with V Pattern', NULL, 'L', 1, 64500, 5, 1535, 3148, 588, 0, 66701, 66701, 45),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Kurtha with V Pattern', NULL, 'XL', 1, 64500, 5, 1535, 3148, 588, 0, 66701, 66701, 46),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Kurtha with V Pattern', NULL, 'XXL', 1, 64500, 5, 1535, 3148, 588, 0, 66701, 66701, 47),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Kurtha with V Pattern', NULL, '3XL', 1, 64500, 5, 1535, 3148, 588, 0, 66701, 66701, 48),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Ajrakh-Print Anarkali - 3-Piece Set with Mirror Work', NULL, 'M', 1, 69500, 5, 1654, 3392, 588, 0, 71826, 71826, 49),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Ajrakh-Print Anarkali - 3-Piece Set with Mirror Work', NULL, 'L', 1, 69500, 5, 1654, 3392, 588, 0, 71826, 71826, 50),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Ajrakh-Print Anarkali - 3-Piece Set with Mirror Work', NULL, 'XL', 1, 69500, 5, 1654, 3392, 588, 0, 71826, 71826, 51),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Ajrakh-Print Anarkali - 3-Piece Set with Mirror Work', NULL, 'XXL', 1, 69500, 5, 1654, 3392, 588, 0, 71826, 71826, 52),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Bandhani 3-Piece Suit Set', NULL, 'M', 1, 78000, 5, 1856, 3807, 588, 0, 80539, 80539, 53),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Bandhani 3-Piece Suit Set', NULL, 'L', 1, 78000, 5, 1856, 3807, 588, 0, 80539, 80539, 54),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Bandhani 3-Piece Suit Set', NULL, 'XL', 1, 78000, 5, 1856, 3807, 588, 0, 80539, 80539, 55),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Bandhani 3-Piece Suit Set', NULL, 'XXL', 1, 78000, 5, 1856, 3807, 588, 0, 80539, 80539, 56),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Jaipuri Print Anarkali', NULL, 'M', 1, 77500, 5, 1845, 3783, 588, 0, 80026, 80026, 57),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Jaipuri Print Anarkali', NULL, 'L', 1, 77500, 5, 1845, 3783, 588, 0, 80026, 80026, 58),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Jaipuri Print Anarkali', NULL, 'XL', 1, 77500, 5, 1845, 3783, 588, 0, 80026, 80026, 59),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Jaipuri Print Anarkali', NULL, 'XXL', 1, 77500, 5, 1845, 3783, 588, 0, 80026, 80026, 60),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Stylish Co-Ord Set', NULL, 'M', 1, 52000, 5, 1238, 2538, 588, 0, 53888, 53888, 61),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Stylish Co-Ord Set', NULL, 'L', 1, 52000, 5, 1238, 2538, 588, 0, 53888, 53888, 62),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Stylish Co-Ord Set', NULL, 'XL', 1, 52000, 5, 1238, 2538, 588, 0, 53888, 53888, 63),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Stylish Co-Ord Set', NULL, 'XXL', 1, 52000, 5, 1238, 2538, 588, 0, 53888, 53888, 64),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Chikankari Angrekha', NULL, 'M', 1, 76000, 5, 1809, 3710, 588, 0, 78489, 78489, 65),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Chikankari Angrekha', NULL, 'L', 1, 76000, 5, 1809, 3710, 588, 0, 78489, 78489, 66),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Chikankari Angrekha', NULL, 'XL', 1, 76000, 5, 1809, 3710, 588, 0, 78489, 78489, 67),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Chikankari Angrekha', NULL, 'XXL', 1, 76000, 5, 1809, 3710, 588, 0, 78489, 78489, 68),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Chics Zig Zag Cord Set', NULL, 'S', 1, 47000, 5, 1119, 2294, 588, 0, 48763, 48763, 69),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Chics Zig Zag Cord Set', NULL, 'M', 1, 47000, 5, 1119, 2294, 588, 0, 48763, 48763, 70),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Chics Zig Zag Cord Set', NULL, 'L', 1, 47000, 5, 1119, 2294, 588, 0, 48763, 48763, 71),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Chics Zig Zag Cord Set', NULL, 'XL', 1, 47000, 5, 1115, 2294, 588, 0, 48767, 48767, 72),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Short Kurthi', 'Brown', 'S', 1, 15500, 5, 369, 757, 588, 0, 16476, 16476, 73),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Short Kurthi', 'Brown', 'M', 1, 15500, 5, 369, 757, 588, 0, 16476, 16476, 74),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Short Kurthi', 'Brown', 'L', 1, 15500, 5, 369, 757, 588, 0, 16476, 16476, 75),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Short Kurthi', 'Brown', 'XL', 1, 15500, 5, 369, 757, 588, 0, 16476, 16476, 76),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Regular Kurthas', 'Mustard', 'L', 1, 26000, 5, 619, 1269, 588, 0, 27238, 27238, 77),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Regular Kurthas', 'Mustard', 'XL', 1, 26000, 5, 619, 1269, 588, 0, 27238, 27238, 78),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Regular Kurthas', 'Navy blue with pink flower', 'M', 1, 26000, 5, 619, 1269, 588, 0, 27238, 27238, 79),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Regular Kurthas', 'Navy blue with pink flower', 'L', 1, 26000, 5, 619, 1269, 588, 0, 27238, 27238, 80),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Regular Kurthas', 'Navy blue with pink flower', 'XL', 1, 26000, 5, 619, 1269, 588, 0, 27238, 27238, 81),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Regular Kurthas', 'Black', 'M', 1, 26000, 5, 619, 1269, 588, 0, 27238, 27238, 82),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Regular Kurthas', 'Black', 'L', 1, 26000, 5, 619, 1269, 588, 0, 27238, 27238, 83),
    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = 'PO-00005'), 'Straight Regular Kurthas', 'Black', 'XL', 1, 26000, 5, 615, 1269, 588, 0, 27242, 27242, 84);

  -- Link each line to the product it bought, where the catalogue still carries
  -- that name. Matched on a normalised name — punctuation and case vary
  -- between the workbook and the site, and "Short Kurthi - Red" and
  -- "Short Kurthi — Red" are one product written two ways.
  --
  -- First pass: name and colour together, which is how the catalogue names a
  -- product that comes in more than one colour.
  UPDATE purchase_lines pl
  SET product_id = p.id
  FROM products p
  WHERE pl.product_id IS NULL
    AND pl.colour IS NOT NULL
    AND btrim(lower(regexp_replace(p.name, '[^a-zA-Z0-9]+', ' ', 'g')))
      = btrim(lower(regexp_replace(pl.item || ' ' || pl.colour, '[^a-zA-Z0-9]+', ' ', 'g')));

  -- Second pass: the name on its own, for products sold in one colour.
  UPDATE purchase_lines pl
  SET product_id = p.id
  FROM products p
  WHERE pl.product_id IS NULL
    AND btrim(lower(regexp_replace(p.name, '[^a-zA-Z0-9]+', ' ', 'g')))
      = btrim(lower(regexp_replace(pl.item, '[^a-zA-Z0-9]+', ' ', 'g')));

  -- Anything still unlinked is a product that was renamed on the site after it
  -- was bought. The line is still a true record of the purchase and shows on
  -- the purchase page; it simply has no product to point at. Ten products are
  -- known to have been renamed, so a handful here is expected, not a fault.

  -- The one payment that never reached this app: G.D. Fabrics, invoice GD707.
  INSERT INTO expenses (id, spent_on, category, description, payee, amount_paise,
    gst_rate_bp, payment_mode, reference, notes)
  SELECT * FROM (VALUES
    (gen_random_uuid()::text, DATE '2026-09-07', 'Stock purchase', 'Stock order — invoice GD707',
     'G.D. Fabrics', 4643300, 500, 'UPI', 'PO-00005',
     'Imported from workbook Payment Tracker PAY-00014; missed by migration 016'),
    (gen_random_uuid()::text, DATE '2026-09-07', 'Transportation', 'Inbound freight — invoice GD707',
     'G.D. Fabrics', 50000, NULL, 'UPI', 'SHIP-GDF-GD707',
     'VRL Logistics, Jaipur to Bengaluru. Imported from workbook Payment Tracker PAY-00015')
  ) AS e(id, spent_on, category, description, payee, amount_paise, gst_rate_bp, payment_mode, reference, notes)
  WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE reference = 'PO-00005');

END
$backfill$;
