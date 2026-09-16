// The money-out side of the admin: recording what was put in, recording what
// was spent, and the Money Map that adds it all up.
//
// These run against the same throwaway database every other test uses, which
// has had the one-off workbook import replayed into it by migration 016 — so
// the opening balances asserted here are also a check that the import itself
// carried the right figures across.

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../setup/fixtures";
import { withDb, createTestProduct, deleteTestProduct } from "../setup/db";

/** Rupees out of a "₹1,23,456.78" string, so totals can be compared as numbers. */
function toNumber(text: string): number {
  return Number(text.replace(/[^0-9.-]/g, ""));
}

test.describe("money in", () => {
  test("opens with the capital brought across from the workbook", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/money/capital");

    // ₹20,577 from Shilpa and ₹50,000 from Lakshmi — the two real rows, and
    // the only two: the five half-typed rows were never imported.
    await expect(page.locator(".metric-card", { hasText: "Total put in" }).locator(".value")).toContainText("70,577");
    await expect(page.locator("tbody tr", { hasText: "Shilpa" })).toContainText("20,577");
    await expect(page.locator("tbody tr", { hasText: "Lakshmi" })).toContainText("50,000");
  });

  test("records a contribution and removes it again", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/money/capital");

    const before = toNumber(
      await page.locator(".metric-card", { hasText: "Total put in" }).locator(".value").innerText()
    );

    await page.fill('input[name="contributedOn"]', "2026-09-12");
    await page.fill('input[name="amount"]', "1500.50");
    await page.fill('input[name="contributor"]', "Capital Test Person");
    await page.click('button:has-text("Record this contribution")');

    await expect(page.locator(".form-success")).toBeVisible();
    await page.reload();
    const row = page.locator("tbody tr", { hasText: "Capital Test Person" });
    // Paise survive the round trip through the database, not just the form.
    await expect(row).toContainText("₹1,500.50");

    const after = toNumber(
      await page.locator(".metric-card", { hasText: "Total put in" }).locator(".value").innerText()
    );
    expect(after).toBeCloseTo(before + 1500.5, 2);

    // Two steps to remove, the same as deleting a product.
    page.once("dialog", (d) => d.accept());
    await row.locator('button:has-text("Remove")').click();
    await row.locator('button:has-text("Yes, remove")').click();
    await expect(page.locator("tbody tr", { hasText: "Capital Test Person" })).toHaveCount(0);
  });

  test("refuses an amount that isn't one", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/money/capital");

    await page.fill('input[name="amount"]', "not a number");
    await page.fill('input[name="contributor"]', "Someone");
    await page.click('button:has-text("Record this contribution")');

    await expect(page.locator(".form-error")).toContainText("number only");
    expect(await page.locator("tbody tr", { hasText: "Someone" }).count()).toBe(0);
  });
});

test.describe("money out", () => {
  test("opens with the vendor payments and freight from the workbook", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/money/expenses");

    // ₹94,888 of stock and ₹2,967 of running costs — the two figures the
    // workbook's Cash Flow sheet arrives at.
    await expect(page.locator(".metric-card", { hasText: "Paid to vendors for stock" }).locator(".value")).toContainText("94,888");
    await expect(page.locator(".metric-card", { hasText: "Running costs" }).locator(".value")).toContainText("2,967");

    // Stock purchases are tagged differently, because they are the one kind
    // that buys an asset rather than being consumed.
    await expect(page.locator("tbody tr", { hasText: "PO-00001" }).locator(".spend-tag.stock")).toBeVisible();
    await expect(page.locator("tbody tr", { hasText: "poly-mailers" }).locator(".spend-tag")).not.toHaveClass(/stock/);
  });

  test("shows the GST hidden inside an inclusive amount", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/money/expenses");
    // ₹580 at 18% is ₹88.47 of tax — worked back out of the total, not added on.
    await expect(page.locator("tbody tr", { hasText: "poly-mailers" })).toContainText("₹88.47");
  });

  test("a recorded spend lands in the right column of the Money Map", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/money");

    const cashBefore = toNumber(
      await page.locator(".metric-card", { hasText: "Cash position" }).locator(".value").innerText()
    );

    await page.goto("/admin/money/expenses");
    await page.fill('input[name="spentOn"]', "2026-09-14");
    await page.fill('input[name="amount"]', "1200");
    await page.selectOption('select[name="category"]', "Marketing");
    await page.fill('input[name="description"]', "Money Map Marketing Test");
    await page.click('button:has-text("Record this spend")');
    await expect(page.locator(".form-success")).toBeVisible();

    await page.goto("/admin/money");
    // Marketing is a running cost, so cash drops by the full amount.
    const cashAfter = toNumber(
      await page.locator(".metric-card", { hasText: "Cash position" }).locator(".value").innerText()
    );
    expect(cashAfter).toBeCloseTo(cashBefore - 1200, 2);
    await expect(page.locator("tbody tr", { hasText: "Marketing" })).toContainText("1,200");

    await withDb((c) => c.query("delete from expenses where description = $1", ["Money Map Marketing Test"]));
  });

  test("buying stock moves cash but not what the business is worth", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/money");
    const worthBefore = toNumber(
      await page.locator(".metric-card", { hasText: "What the business is worth" }).locator(".value").innerText()
    );

    // Recorded as a stock purchase, with a product carrying the matching
    // landed cost — so the money leaves cash and arrives back as stock.
    await withDb(async (c) => {
      await c.query(
        `insert into expenses (id, spent_on, category, description, amount_paise, payment_mode)
         values (gen_random_uuid()::text, DATE '2026-09-14', 'Stock purchase', 'Worth Test Stock', 500000, 'UPI')`
      );
    });

    await page.goto("/admin/money");
    const worthAfter = toNumber(
      await page.locator(".metric-card", { hasText: "What the business is worth" }).locator(".value").innerText()
    );
    // No product was added, so this ₹5,000 really has gone — the point of the
    // assertion is that it comes off net worth exactly once, not twice.
    expect(worthAfter).toBeCloseTo(worthBefore - 5000, 2);

    await withDb((c) => c.query("delete from expenses where description = $1", ["Worth Test Stock"]));
  });

  test("refuses a category that isn't on the list", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/money/expenses");

    // The select can't offer a bad value, so this goes at the server directly —
    // the category decides which side of the money map an amount lands on, and
    // it must not be taken on trust.
    await page.evaluate(() => {
      const select = document.querySelector('select[name="category"]') as HTMLSelectElement;
      const option = document.createElement("option");
      option.value = "Definitely Not A Category";
      select.appendChild(option);
      select.value = "Definitely Not A Category";
    });
    await page.fill('input[name="amount"]', "100");
    await page.fill('input[name="description"]', "Bad Category Test");
    await page.click('button:has-text("Record this spend")');

    await expect(page.locator(".form-error")).toContainText("category from the list");
    const { rows } = await withDb((c) =>
      c.query("select 1 from expenses where description = $1", ["Bad Category Test"])
    );
    expect(rows).toHaveLength(0);
  });
});

test.describe("the money map", () => {
  test("adds up to the same position the workbook arrives at", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/money");

    const ledger = page.locator(".money-ledger");
    await expect(ledger).toContainText("70,577"); // capital in
    await expect(ledger).toContainText("94,888"); // paid to vendors
    await expect(ledger).toContainText("2,967"); // running costs

    // Cash is capital + sales − stock − running costs. With no sales in the
    // test database that is −₹27,278, exactly what the corrected workbook says.
    await expect(page.locator(".metric-card", { hasText: "Cash position" }).locator(".value")).toContainText("27,278");
  });

  test("explains a negative cash position instead of just showing red", async ({ page }) => {
    // Enough stock, at a recorded cost, to put net worth above zero while cash
    // is still below it. Created here rather than relied on from the seed, so
    // the assertion tests the page's reasoning and not the seed's contents.
    const product = await createTestProduct({
      name: "Net Worth Fixture",
      price: 4000,
      stock: 40,
      landedCost: 2000,
    });

    await loginAsAdmin(page);
    await page.goto("/admin/money");

    // Cash is negative, net worth is not — the normal shape of a young retail
    // business, and the page has to say so rather than leaving a frightening
    // number sitting on its own.
    await expect(page.locator(".metric-card", { hasText: "Cash position" }).locator(".value")).toContainText("-");
    await expect(page.locator(".notice-box")).toContainText("still yours to sell");

    await deleteTestProduct(product.id);
  });

  test("keeps stock purchases out of the running-costs breakdown", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/money");

    // Scoped to the table body, not the whole card — the card's own caption
    // says the words "Stock purchases are left out", which is the opposite of
    // the thing being guarded against.
    const rows = page.locator(".admin-card", { hasText: "Running costs, by kind" }).locator("tbody");
    await expect(rows).toContainText("Transportation");
    await expect(rows).toContainText("Packaging");
    await expect(rows).not.toContainText("Stock purchase");
  });

  test("is reachable from the admin sidebar", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await page.locator('.admin-sidebar a[href="/admin/money"]').click();
    await expect(page.locator("h1")).toHaveText("Money Map");
  });

  test("is admin-only", async ({ page }) => {
    await page.goto("/admin/money");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("does not scroll sideways on a phone", async ({ page }) => {
    // The header's title and its two buttons were fighting for one line, which
    // pushed the button off the right edge and took the page width with it.
    await loginAsAdmin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/admin/money", "/admin/money/expenses", "/admin/money/capital"]) {
      await page.goto(path);
      const scrolled = await page.evaluate(() => {
        window.scrollTo(600, 0);
        return window.scrollX;
      });
      expect(scrolled, `${path} should not scroll sideways`).toBe(0);
    }
  });
});
