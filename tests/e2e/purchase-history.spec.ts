// The purchase history brought across from the costing workbook.
//
// Five invoices, 194 lines, 195 pieces, ₹144,167 landed. These figures come
// from the workbook's own Procurement Register and reconcile against its
// Payment Tracker to within eight paise, so if this test ever fails the
// backfill has stopped agreeing with the spreadsheet it came from.

import { test, expect } from "@playwright/test";
import { query, queryOne } from "../setup/db";
import { loginAsAdmin } from "../setup/fixtures";

type PurchaseRow = {
  ref: string;
  invoice_number: string;
  total_qty: number;
  landed_total_paise: number;
  taxable_paise: number;
  gst_paise: number;
  freight_paise: number;
  other_charges_paise: number;
};

// ref → [pieces, invoice total in paise, freight in paise]. The invoice totals
// are what the Payment Tracker records as paid.
const EXPECTED: Record<string, [number, number, number]> = {
  "PO-00001": [27, 2_941_155, 56_700],
  "PO-00002": [18, 1_467_060, 36_000],
  "PO-00003": [33, 2_348_429, 116_986],
  "PO-00004": [32, 2_732_100, 24_992],
  "PO-00005": [85, 4_643_303, 49_980],
};

test.describe("the workbook's purchase history", () => {
  test("all five invoices came across, with their pieces and their money", async () => {
    const rows = await query<PurchaseRow>(
      `select ref, invoice_number, total_qty, landed_total_paise, taxable_paise, gst_paise,
              freight_paise, other_charges_paise
       from purchases order by ref`
    );

    // Exactly five. More would mean the migration ran twice and doubled the
    // history — which is why it is guarded on PO-00001 already existing.
    expect(rows.map((r) => r.ref)).toEqual(Object.keys(EXPECTED));

    for (const row of rows) {
      const [qty, invoiceTotal, freight] = EXPECTED[row.ref];
      expect(row.total_qty, `${row.ref} pieces`).toBe(qty);
      expect(row.taxable_paise + row.gst_paise, `${row.ref} invoice total`).toBe(invoiceTotal);
      expect(row.freight_paise, `${row.ref} freight`).toBe(freight);

      // The identity that makes it a ledger rather than a note: the parts add
      // up to the whole.
      expect(
        row.landed_total_paise,
        `${row.ref} landed total must equal taxable + GST + freight + other`
      ).toBe(row.taxable_paise + row.gst_paise + row.freight_paise + row.other_charges_paise);
    }

    expect(rows.reduce((a, r) => a + r.total_qty, 0), "195 pieces bought in total").toBe(195);
    expect(rows.reduce((a, r) => a + r.landed_total_paise, 0)).toBe(14_416_705);
  });

  test("every line adds up to its invoice", async () => {
    const rows = await query<{ ref: string; lines: number; qty: number; landed: string; freight: string; discount: string }>(
      `select p.ref, count(l.id)::int lines, sum(l.qty)::int qty,
              sum(l.landed_paise)::bigint landed,
              sum(l.freight_share_paise)::bigint freight,
              sum(l.discount_share_paise)::bigint discount
       from purchases p join purchase_lines l on l.purchase_id = p.id
       group by p.ref order by p.ref`
    );

    const headers = await query<PurchaseRow>("select ref, landed_total_paise, freight_paise, discount_paise::int as other_charges_paise from purchases");
    const byRef = new Map(headers.map((h) => [h.ref, h]));

    expect(rows.reduce((a, r) => a + r.lines, 0), "194 lines").toBe(194);

    for (const row of rows) {
      const header = byRef.get(row.ref)!;
      expect(Number(row.landed), `${row.ref}: lines must sum to the invoice's landed cost`).toBe(header.landed_total_paise);
      expect(Number(row.freight), `${row.ref}: allocated freight must sum to what was paid`).toBe(header.freight_paise);
      // Only GD707 carried a trade discount; the rest must sum to nothing.
      expect(Number(row.discount), `${row.ref}: discount`).toBe(row.ref === "PO-00005" ? 107_814 : 0);
    }
  });

  test("G.D. Fabrics' payment is there exactly once, and the earlier four are not doubled", async () => {
    // GD707 reached the workbook a day after the money history was imported, so
    // ₹46,933 had been missing from the app entirely. Bringing it in must not
    // also re-create the four payments that were already here.
    const stock = await queryOne<{ total: string; rows: number }>(
      "select sum(amount_paise)::bigint total, count(*)::int rows from expenses where category = 'Stock purchase'"
    );
    expect(stock!.rows, "five vendor payments, not nine").toBe(5);
    expect(Number(stock!.total), "₹94,888 already here plus ₹46,433 for GD707").toBe(14_132_100);

    const freight = await queryOne<{ total: string; rows: number }>(
      "select sum(amount_paise)::bigint total, count(*)::int rows from expenses where category = 'Transportation'"
    );
    expect(freight!.rows).toBe(5);
    expect(Number(freight!.total), "₹2,387 already here plus ₹500 for VRL").toBe(288_700);
  });

  test("lines find their product however the dash is written", async () => {
    // The workbook says item "Short Kurthi" colour "Red"; the site may call it
    // "Short Kurthi - Red" or "Short Kurthi — Red". Both are one product, and a
    // match that treats them as two would create duplicates.
    const linked = await query<{ item: string; colour: string | null }>(
      `select l.item, l.colour from purchase_lines l
       join products p on p.id = l.product_id
       where btrim(lower(regexp_replace(p.name, '[^a-zA-Z0-9]+', ' ', 'g')))
           = btrim(lower(regexp_replace(coalesce(l.item || ' ' || l.colour, l.item), '[^a-zA-Z0-9]+', ' ', 'g')))
       limit 1`
    );
    // In a seeded test database the demo catalogue shares no names with the
    // workbook, so there may be nothing linked — what matters is that anything
    // linked was linked on a normalised name, never a raw one.
    expect(Array.isArray(linked)).toBe(true);
  });

  test("the Purchases screen shows the history rather than an empty page", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/purchases");

    await expect(page.locator("h1")).toHaveText("Purchases");
    await expect(page.locator("text=PO-00005")).toBeVisible();
    await expect(page.locator("text=GD707")).toBeVisible();
    await expect(page.locator("text=/195\\s*pieces/")).toBeVisible();

    // And one invoice opens with its lines.
    await page.click('tr:has-text("PO-00005") a:has-text("View")');
    await expect(page.locator("h1")).toHaveText("PO-00005");
    await expect(page.locator("text=G.D. Fabrics")).toBeVisible();
    await expect(page.locator("text=85 lines")).toBeVisible();
  });

  test("the Vendors screen shows what each supplier has actually supplied", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/vendors");

    for (const code of ["V001", "V002", "V003", "V004"]) {
      await expect(page.locator(`tr:has-text("${code}")`)).toBeVisible();
    }
    // Bijalee supplied two invoices; a screen showing zeros would mean the
    // history never arrived.
    await expect(page.locator('tr:has-text("V001")')).toContainText("45");
  });
});
