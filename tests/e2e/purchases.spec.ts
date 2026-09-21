// Entering a purchase, and what follows from it.
//
// This is the flow that makes the app the system of record rather than a copy
// of the costing workbook: one invoice in, and the products, the sizes, the
// stock, the landed cost, the price and the money paid all follow. Each of
// those was a separate manual step across two systems before.

import { test, expect, type Page } from "@playwright/test";
import { query, queryOne, withDb } from "../setup/db";
import { loginAsAdmin } from "../setup/fixtures";

const stamp = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function brief(opts: {
  item: string;
  invoiceNumber: string;
  vendor?: string;
  lines?: { colour?: string; size: string; qty: number; unitPrice: number }[];
  freight?: number;
  discount?: number;
}): string {
  const lines = opts.lines ?? [
    { colour: "Red", size: "S", qty: 2, unitPrice: 200 },
    { colour: "Red", size: "M", qty: 3, unitPrice: 200 },
  ];
  return JSON.stringify({
    vendor: { name: opts.vendor ?? "Test Weavers", city: "Jaipur", state: "Rajasthan", type: "Manufacturer" },
    invoice: { number: opts.invoiceNumber, date: "2026-09-07", freight: opts.freight ?? 0, discount: opts.discount ?? 0, paymentMode: "UPI" },
    lines: lines.map((l) => ({
      item: opts.item,
      colour: l.colour ?? null,
      size: l.size,
      qty: l.qty,
      unitPrice: l.unitPrice,
      gstRatePct: 5,
      category: "Casual Wear",
      fabric: "Cotton",
    })),
  });
}

async function enterPurchase(page: Page, json: string) {
  await page.goto("/admin/purchases/new");
  await page.fill("#brief", json);
  await page.click('button:has-text("Check it")');
  await expect(page.locator('button:has-text("Record this purchase")')).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.click('button:has-text("Record this purchase")');
  await expect(page.locator("text=Recorded as")).toBeVisible();
}

/**
 * Wait for a row the server has just written.
 *
 * The suite watches the database over its own connection, so a read taken the
 * instant the screen updates can land before the write is visible to it. This
 * polls instead of reading once — it still fails if the row never appears, but
 * it does not fail because of a few milliseconds.
 */
async function waitForRow<T>(read: () => Promise<T | null>, what: string): Promise<T> {
  let row: T | null = null;
  await expect
    .poll(async () => {
      row = await read();
      return row != null;
    }, { message: `waiting for ${what}`, timeout: 10_000 })
    .toBe(true);
  return row as T;
}

async function cleanUp(item: string, vendorName: string) {
  await withDb(async (c) => {
    await c.query("delete from purchase_lines where item = $1", [item]);
    await c.query(
      "delete from purchases where vendor_id in (select id from vendors where name = $1)",
      [vendorName]
    );
    await c.query("delete from expenses where payee = $1", [vendorName]);
    await c.query("delete from vendors where name = $1", [vendorName]);
    await c.query("delete from product_sizes where product_id in (select id from products where name like $1)", [`${item}%`]);
    await c.query("delete from products where name like $1", [`${item}%`]);
  });
}

test.describe("recording a purchase", () => {
  test("one invoice creates the products, the stock, the cost and the payment", async ({ page }) => {
    const item = `Test Kurthi ${stamp()}`;
    const vendor = `Test Weavers ${stamp()}`;
    const invoiceNumber = `INV-${stamp()}`;

    await loginAsAdmin(page);
    await enterPurchase(page, brief({ item, invoiceNumber, vendor, freight: 50 }));

    // ---- the product: created, and switched OFF because it has no photographs
    const product = await waitForRow(
      () =>
        queryOne<{ id: string; price: number; landed_cost: number; stock: number; is_active: boolean; sku: string }>(
          "select id, price, landed_cost, stock, is_active, sku from products where name = $1",
          [`${item} — Red`]
        ),
      "the product this invoice buys"
    );
    expect(product.is_active, "a new product must not go live before it has photographs").toBe(false);
    expect(product.sku).toMatch(/^URVI-CAS-\d{3}$/);

    // ---- stock: five pieces, split across the two sizes actually bought
    expect(product.stock).toBe(5);
    const sizes = await query<{ label: string; stock: number }>(
      "select label, stock from product_sizes where product_id = $1 order by position",
      [product.id]
    );
    expect(sizes).toEqual([
      { label: "S", stock: 2 },
      { label: "M", stock: 3 },
    ]);

    // ---- landed cost: ₹200 + 5% GST + ₹10 of freight a piece = ₹220
    expect(product.landed_cost).toBe(220);
    // ---- and priced from the default band: 50% over ₹220 is ₹330
    expect(product.price).toBe(330);

    // ---- the money: stock purchase and freight kept apart
    const spends = await waitForRow(
      async () => {
        const rows = await query<{ category: string; amount_paise: number }>(
          "select category, amount_paise from expenses where payee = $1 order by category",
          [vendor]
        );
        return rows.length === 2 ? rows : null;
      },
      "the money recorded against this invoice"
    );
    expect(spends.map((s) => s.category).sort()).toEqual(["Stock purchase", "Transportation"]);
    const stockSpend = spends.find((s) => s.category === "Stock purchase")!;
    const freight = spends.find((s) => s.category === "Transportation")!;
    expect(stockSpend.amount_paise).toBe(105_000); // ₹1,000 + 5% GST
    expect(freight.amount_paise).toBe(5_000);

    // ---- the purchase itself, with its lines
    const purchase = await waitForRow(
      () =>
        queryOne<{ id: string; ref: string; landed_total_paise: number; total_qty: number }>(
          "select id, ref, landed_total_paise, total_qty from purchases where invoice_number = $1",
          [invoiceNumber]
        ),
      "the purchase record"
    );
    expect(purchase.ref).toMatch(/^PO-\d{5}$/);
    expect(purchase.total_qty).toBe(5);
    expect(purchase.landed_total_paise).toBe(110_000); // ₹1,050 invoice + ₹50 freight

    const lines = await query("select id from purchase_lines where purchase_id = $1", [purchase.id]);
    expect(lines).toHaveLength(2);

    await cleanUp(item, vendor);
  });

  test("a restock adds stock and re-costs, but never moves a live price", async ({ page }) => {
    const item = `Test Restock ${stamp()}`;
    const vendor = `Test Restockers ${stamp()}`;

    await loginAsAdmin(page);
    await enterPurchase(page, brief({ item, invoiceNumber: `A-${stamp()}`, vendor }));

    const name = `${item} — Red`;
    const first = await waitForRow(
      () => queryOne<{ id: string; price: number; landed_cost: number }>("select id, price, landed_cost from products where name = $1", [name]),
      "the product on its first purchase"
    );
    // ₹200 + 5% = ₹210, marked up 50% and rounded up to ₹10 → ₹320.
    expect(first.landed_cost).toBe(210);
    expect(first.price).toBe(320);

    // Put it on sale, as she would once it has photographs.
    await withDb((c) => c.query("update products set is_active = true where id = $1", [first.id]));

    // Second invoice, same item, dearer.
    await enterPurchase(page, brief({
      item,
      invoiceNumber: `B-${stamp()}`,
      vendor,
      lines: [{ colour: "Red", size: "S", qty: 5, unitPrice: 400 }],
    }));

    const after = await waitForRow(
      async () => {
        const row = await queryOne<{ price: number; landed_cost: number; stock: number }>(
          "select price, landed_cost, stock from products where name = $1",
          [name]
        );
        return row && row.stock === 10 ? row : null;
      },
      "the restocked product"
    );

    expect(after.stock, "the new pieces are added to what was already there").toBe(10);
    // Weighted across both purchases: (5 × ₹210 + 5 × ₹420) / 10 = ₹315.
    expect(after.landed_cost).toBe(315);
    // The band would now say ₹480 — but a price already on sale is a decision,
    // not a fact, so it is left alone and offered on the Pricing screen.
    expect(after.price, "entering paperwork must never re-price a live product").toBe(320);

    await cleanUp(item, vendor);
  });

  test("a bad invoice block is refused, with every reason at once", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/purchases/new");
    await page.fill("#brief", JSON.stringify({
      vendor: {},
      invoice: { number: "", date: "07-09-2026" },
      lines: [{ item: "", size: "", qty: 0, unitPrice: "abc" }],
    }));
    await page.click('button:has-text("Check it")');

    const box = page.locator(".notice-box").filter({ hasText: "can't be saved yet" });
    await expect(box).toBeVisible();
    await expect(box.locator("li")).not.toHaveCount(1);
    await expect(page.locator('button:has-text("Record this purchase")')).toHaveCount(0);
  });

  test("an unknown category is caught before anything is written", async ({ page }) => {
    const item = `Test Uncategorised ${stamp()}`;
    await loginAsAdmin(page);
    await page.goto("/admin/purchases/new");
    await page.fill("#brief", brief({ item, invoiceNumber: `C-${stamp()}` }).replace('"Casual Wear"', '"Nonsense Wear"'));
    await page.click('button:has-text("Check it")');

    await expect(page.locator("text=/doesn.t exist on the site/").first()).toBeVisible();
    await expect(page.locator('button:has-text("Record this purchase")')).toBeDisabled();

    const leaked = await query("select id from products where name like $1", [`${item}%`]);
    expect(leaked, "nothing may be written while the plan is refused").toHaveLength(0);
  });
});

test.describe("pricing bands", () => {
  test("the screen shows what she is already charging, and saving a band moves no price", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/pricing");

    await expect(page.locator("h1")).toHaveText("Pricing");
    await expect(page.locator("#target_0")).toHaveValue("50");
    await expect(page.locator("#min_0")).toHaveValue("30");

    const before = await query<{ id: string; price: number }>("select id, price from products order by id");

    await page.fill("#target_0", "80");
    await page.click('button:has-text("Save bands")');
    await expect(page.locator(".form-success")).toContainText("No price has moved");

    const after = await query<{ id: string; price: number }>("select id, price from products order by id");
    expect(after).toEqual(before);

    // Put it back so the rest of the suite sees the seeded bands.
    await page.fill("#target_0", "50");
    await page.click('button:has-text("Save bands")');
    await expect(page.locator(".form-success")).toBeVisible();
  });

  test("a band that leaves the dearest stock unpriced is refused", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/pricing");
    // A floor above its own target would price a discount higher than the
    // full price.
    await page.fill("#min_0", "200");
    await page.click('button:has-text("Save bands")');
    await expect(page.locator(".form-error")).toContainText("floor would sit above");
  });
});
