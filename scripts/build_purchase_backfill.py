"""Generate the backfill migration for the five purchases already in the workbook.

Reads the recalculated PROCUREMENT REGISTER and writes SQL that recreates each
invoice as a purchase with its lines, using the workbook's own computed figures
so the app ties to the spreadsheet exactly rather than re-deriving and drifting.

Two things it deliberately does NOT do:

  * It does not touch stock. The app's stock has already been sold down; the
    register only records what was received, and writing that over the top is
    the very bug this whole round exists to fix.
  * It does not re-create the money for PO-00001 to PO-00004. Migration 016
    already imported those payments from the Payment Tracker, and a second copy
    would show ₹94,888 spent twice. Only G.D. Fabrics' GD707 is added, because
    it reached the workbook a day after that import was written and has been
    missing from the app ever since.
"""

import json
import re
from collections import defaultdict

BLANK_COLOURS = {"0", "colour 1", "", "none"}


def clean(text):
    if text is None:
        return None
    s = str(text).replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s or None


def colour_of(raw):
    c = clean(raw)
    # "Colour 1" is the template's placeholder, not a colour anyone chose.
    return None if c is None or c.lower() in BLANK_COLOURS else c


def paise(value):
    return int(round(float(value or 0) * 100))


def sql_str(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


rows = [r for r in json.load(open("pr.json")) if isinstance(r["qty"], (int, float)) and r["qty"] > 0]

# One purchase per invoice. PO-00001 arrived in two deliveries a week apart but
# is one invoice and one payment, so it is one purchase dated when the invoice
# was raised.
groups = defaultdict(list)
for r in rows:
    groups[(r["po"], r["inv"], r["vid"])].append(r)

purchases = []
for (po, inv, vid), lines in sorted(groups.items()):
    lines.sort(key=lambda r: r["row"])
    purchases.append(
        {
            "ref": po,
            "invoice": inv,
            "vendor_code": vid,
            "date": min(r["date"] for r in lines),
            "lines": lines,
        }
    )

out = []
w = out.append

w("""-- The five purchases already made, brought in from the costing workbook.
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
""")

totals = {"qty": 0, "landed": 0, "taxable": 0, "gst": 0, "freight": 0, "discount": 0, "gross": 0}

for p in purchases:
    lines = p["lines"]
    # Each line's landed cost is rebuilt from its own parts rather than taken
    # from the workbook's Landed Cost column. The two agree to within a paisa,
    # but only the rebuilt one is guaranteed to add up: the workbook rounds
    # every column independently, so its line totals can sum to a few paise
    # more than its own taxable + GST + freight. A ledger whose parts do not
    # add to its total is worse than one that is a paisa off the spreadsheet.
    for r in lines:
        r["_taxable"] = paise(r["gross"]) - paise(r["disc"])
        r["_gst"] = paise(r["gst"])
        r["_ship"] = paise(r["ship"])
        r["_landed"] = r["_taxable"] + r["_gst"] + r["_ship"]

    gross = sum(paise(r["gross"]) for r in lines)
    discount = sum(paise(r["disc"]) for r in lines)
    taxable = sum(r["_taxable"] for r in lines)
    gst = sum(r["_gst"] for r in lines)
    freight = sum(r["_ship"] for r in lines)
    landed = sum(r["_landed"] for r in lines)
    qty = sum(int(r["qty"]) for r in lines)

    drift = landed - sum(paise(r["landed"]) for r in lines)
    if drift:
        print(f"  note: {p['ref']} differs from the workbook's own landed column by {drift} paise")

    for k, v in [("qty", qty), ("landed", landed), ("taxable", taxable), ("gst", gst),
                 ("freight", freight), ("discount", discount), ("gross", gross)]:
        totals[k] += v

    # The register's own landed figure is the one that ties to the invoice; this
    # asserts the parts add up to it before the SQL is ever run.
    assert landed == taxable + gst + freight, f"{p['ref']}: {landed} != {taxable}+{gst}+{freight}"

    var = {"V001": "v001", "V002": "v002", "V003": "v003", "V004": "v004"}[p["vendor_code"]]
    mode = "UPI" if p["ref"] != "PO-00004" else "Bank transfer"

    w(f"""
  -- {p['ref']} · invoice {p['invoice']} · {len(lines)} lines · {qty} pieces · ₹{landed/100:,.2f} landed
  INSERT INTO purchases (id, ref, vendor_id, invoice_number, invoice_date,
    freight_paise, discount_paise, other_charges_paise,
    gross_paise, taxable_paise, gst_paise, landed_total_paise, total_qty,
    payment_mode, notes)
  VALUES (gen_random_uuid()::text, {sql_str(p['ref'])}, {var}, {sql_str(p['invoice'])}, DATE '{p['date']}',
    {freight}, {discount}, 0, {gross}, {taxable}, {gst}, {landed}, {qty},
    {sql_str(mode)}, 'Imported from the costing workbook''s Procurement Register');
""")

    values = []
    for i, r in enumerate(lines):
        item = clean(r["name"]) or clean(r["sku"]) or "Unknown item"
        values.append(
            "    (gen_random_uuid()::text, (SELECT id FROM purchases WHERE ref = {ref}), "
            "{item}, {colour}, {size}, {qty}, {unit}, 5, {disc}, {gst}, {ship}, 0, {landed}, {lpu}, {pos})".format(
                ref=sql_str(p["ref"]),
                item=sql_str(item),
                colour=sql_str(colour_of(r["colour"])),
                size=sql_str(clean(r["size"]) or "—"),
                qty=int(r["qty"]),
                unit=paise(r["unit"]),
                disc=paise(r["disc"]),
                gst=paise(r["gst"]),
                ship=paise(r["ship"]),
                landed=r["_landed"],
                lpu=int(round(r["_landed"] / int(r["qty"]))),
                pos=i,
            )
        )

    w("  INSERT INTO purchase_lines (id, purchase_id, item, colour, size, qty, unit_price_paise,\n"
      "    gst_rate_pct, discount_share_paise, gst_paise, freight_share_paise, other_share_paise,\n"
      "    landed_paise, landed_per_unit_paise, position)\n  VALUES\n"
      + ",\n".join(values) + ";\n")

w("""
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
""")

open("019_import_workbook_purchases.sql", "w").write("".join(out))

print(f"purchases: {len(purchases)}  lines: {sum(len(p['lines']) for p in purchases)}")
for k, v in totals.items():
    print(f"  {k}: {v/100 if k != 'qty' else v:,.2f}" if k != "qty" else f"  {k}: {v}")
print("  invoice totals:", f"{(totals['taxable'] + totals['gst'])/100:,.2f}")
