-- The money history that already existed, brought over from the workbook once.
--
-- Without this the new Money In and Money Out screens would open empty, and
-- the Money Map would report a business that had spent nothing and been given
-- nothing — which is a worse lie than the spreadsheet was.
--
-- Every row below is taken from a specific place in URVI_STUDIOS_Business_Workbook.xlsx
-- and is named in its reference column so it can be traced back:
--
--   Capital        — BUSINESS CAPITAL rows 5-6. Totals ₹70,577, which is the
--                    figure the workbook's own Cash Flow uses.
--   Stock purchase — PAYMENT TRACKER, the four PO-* rows. Totals ₹94,888,
--                    matching Cash Flow's "Vendor Payments" exactly.
--   Transportation — PAYMENT TRACKER, the four SHIP-* rows: inbound freight
--                    charged by each vendor. Totals ₹2,387, matching Cash
--                    Flow's "Delivery / Logistics" exactly.
--   Packaging      — EXPENSE REGISTER row 5, the poly-mailers from Amazon.
--
-- The whole thing is wrapped so it can only ever run once. Netlify replays
-- migrations on deploy, and a second run would double every figure on the
-- Money Map — so if either table already has anything in it, this does
-- nothing at all. That also means it will not fight with rows Nagalakshmi
-- adds by hand after the first deploy.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM capital_contributions) OR EXISTS (SELECT 1 FROM expenses) THEN
    RAISE NOTICE 'Money history already present — skipping the one-off workbook import.';
    RETURN;
  END IF;

  INSERT INTO capital_contributions (id, contributed_on, contributor, amount_paise, mode, reference, notes) VALUES
    (gen_random_uuid()::text, DATE '2026-08-20', 'Shilpa',  2057700, 'UPI', 'OWN-INIT-01', 'Business start-up capital (workbook CAP-0001)'),
    (gen_random_uuid()::text, DATE '2026-08-20', 'Lakshmi', 5000000, 'UPI', 'OWN-INIT-01', 'Business start-up capital (workbook CAP-0002)');

  INSERT INTO expenses (id, spent_on, category, description, payee, amount_paise, gst_rate_bp, payment_mode, reference, notes) VALUES
    -- Stock bought from vendors. Counted as stock on the Money Map, not as a
    -- running cost, because it is still on the rail and still sellable.
    (gen_random_uuid()::text, DATE '2026-08-20', 'Stock purchase', 'Stock order — invoice 2026-27/101',     'Bijalee',                   2941200, NULL, 'UPI',           'PO-00001', 'Imported from workbook Payment Tracker'),
    (gen_random_uuid()::text, DATE '2026-08-26', 'Stock purchase', 'Stock order — invoice 2026-27/108',     'Bijalee',                   1467100, NULL, 'UPI',           'PO-00002', 'Imported from workbook Payment Tracker'),
    (gen_random_uuid()::text, DATE '2026-08-31', 'Stock purchase', 'Stock order — invoice B2C182/26-27',    'Jinaaya/Vivaanta fashions', 2348400, NULL, 'UPI',           'PO-00003', 'Imported from workbook Payment Tracker'),
    (gen_random_uuid()::text, DATE '2026-09-07', 'Stock purchase', 'Stock order — invoice IBPW-26/27-350',  'Iccha By Prime',            2732100, NULL, 'Bank transfer', 'PO-00004', 'Imported from workbook Payment Tracker'),

    -- Inbound freight charged by each vendor on top of the goods.
    (gen_random_uuid()::text, DATE '2026-08-20', 'Transportation', 'Inbound freight — invoice 2026-27/101',    'Bijalee',                     58700, NULL, 'UPI',           'SHIP-BIJ-101', 'Imported from workbook Payment Tracker'),
    (gen_random_uuid()::text, DATE '2026-08-26', 'Transportation', 'Inbound freight — invoice 2026-27/108',    'Bijalee',                     38000, NULL, 'UPI',           'SHIP-BIJ-108', 'Imported from workbook Payment Tracker'),
    (gen_random_uuid()::text, DATE '2026-08-31', 'Transportation', 'Inbound freight — invoice 825101/26-27',   'Jinaaya/Vivaanta fashions',  117000, NULL, 'UPI',           'SHIP-VIV-01',  'Imported from workbook Payment Tracker'),
    (gen_random_uuid()::text, DATE '2026-09-07', 'Transportation', 'Inbound freight — invoice IBPW-26/27-350', 'Iccha By Prime',              25000, NULL, 'Bank transfer', 'SHIP-ICC-350', 'Imported from workbook Payment Tracker'),

    -- The one true running cost recorded so far. The date is the one on the
    -- workbook row; it predates the first capital contribution, so it is worth
    -- checking, but it has been brought across as recorded rather than guessed at.
    (gen_random_uuid()::text, DATE '2026-06-04', 'Packaging', 'Branded poly-mailers', 'Amazon', 58000, 1800, 'UPI', NULL, 'Imported from workbook Expense Register');
END
$$;
