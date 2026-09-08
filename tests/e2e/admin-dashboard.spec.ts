// The rest of the admin: the dashboard's numbers, coupons, the contact-form
// inbox, and the customer-data CSV downloads.

import { test, expect } from "@playwright/test";
import { createTestProduct, deleteTestProduct, query, queryOne, uniqueEmail, withDb } from "../setup/db";
import { loginAsAdmin } from "../setup/fixtures";

test.describe("dashboard", () => {
  test("shows the headline numbers and the stock tables", async ({ page }) => {
    await loginAsAdmin(page);

    const cards = page.locator(".metric-card");
    await expect(cards).toHaveCount(4);
    const labels = await cards.locator(".label").allTextContents();
    expect(labels).toEqual(["Total Orders", "Revenue (Paid)", "Needs Action", "Low Stock"]);
    // Every card shows a real value, not a blank.
    for (const value of await cards.locator(".value").allTextContents()) {
      expect(value.trim()).not.toBe("");
    }

    await expect(page.locator(".admin-card", { hasText: "Stock Overview" })).toBeVisible();
  });

  test("flags a size that is nearly sold out", async ({ page }) => {
    const product = await createTestProduct({ name: "Nearly Gone Product", stock: 30, sizes: ["S", "M", "L"] });
    await withDb((client) =>
      client.query("update product_sizes set stock = 1 where product_id = $1 and label = 'S'", [product.id])
    );

    await loginAsAdmin(page);
    await page.goto("/admin");
    const lowBySize = page.locator(".admin-card", { hasText: "Running Low, By Size" });
    await expect(lowBySize).toContainText("Nearly Gone Product");

    await deleteTestProduct(product.id);
  });
});

test.describe("coupons", () => {
  test("creates one, and it then works at checkout", async ({ page }) => {
    const code = `TEST${Date.now().toString(36).toUpperCase().slice(-6)}`;
    await loginAsAdmin(page);
    await page.goto("/admin/coupons");

    await page.fill('input[name="code"]', code);
    await page.selectOption('select[name="type"]', "FLAT");
    await page.fill('input[name="value"]', "300");
    await page.fill('input[name="minOrderValue"]', "1000");
    await page.locator("button", { hasText: "Create Coupon" }).click();

    await expect(page.locator(".notice-box")).toContainText(`Coupon ${code} created`);
    const row = page.locator("tbody tr", { hasText: code });
    await expect(row).toContainText("Flat off");
    await expect(row.getByRole("checkbox")).toBeChecked();

    // It really discounts a real basket.
    const product = await createTestProduct({ name: "Coupon Basket Product", price: 2000 });
    const preview = await page.request.post("/api/checkout/preview-coupon", {
      data: {
        items: [{ productId: product.id, size: "M", color: product.colors[0].name, qty: 1 }],
        couponCode: code,
      },
    });
    expect((await preview.json()).discount).toBe(300);

    // Switching it off takes it out of use.
    await page.goto("/admin/coupons");
    await page.locator("tbody tr", { hasText: code }).getByRole("checkbox").uncheck();
    await expect(async () => {
      const saved = await queryOne<{ active: boolean }>("select active from coupons where code = $1", [code]);
      expect(saved!.active).toBe(false);
    }).toPass({ timeout: 10_000 });

    const afterDisable = await page.request.post("/api/checkout/preview-coupon", {
      data: {
        items: [{ productId: product.id, size: "M", color: product.colors[0].name, qty: 1 }],
        couponCode: code,
      },
    });
    expect((await afterDisable.json()).ok).toBe(false);

    await deleteTestProduct(product.id);
    await withDb((client) => client.query("delete from coupons where code = $1", [code]));
  });

  test("refuses a duplicate code", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/coupons");
    await page.fill('input[name="code"]', "WELCOME10");
    await page.fill('input[name="value"]', "5");
    await page.locator("button", { hasText: "Create Coupon" }).click();
    await expect(page.locator(".notice-box.error")).toContainText("already exists");
  });
});

test.describe("messages", () => {
  test("a contact-form message lands in the inbox and can be marked read", async ({ page }) => {
    const email = uniqueEmail("inbox");
    await page.request.post("/api/contact", {
      data: { name: "Inbox Tester", email, message: "Testing the admin inbox." },
    });

    await loginAsAdmin(page);
    await page.goto("/admin/messages");

    // All messages share one card, so target this message's own block —
    // other tests in the run leave messages here too.
    const message = page.locator(".admin-card > div").filter({ hasText: "Testing the admin inbox." });
    await expect(message).toContainText("Inbox Tester");
    await expect(message.locator(`a[href="mailto:${email}"]`)).toBeVisible();

    await message.locator("button", { hasText: "Mark as read" }).click();
    await expect(message.locator("button", { hasText: "Mark as new" })).toBeVisible();

    await expect(async () => {
      const saved = await queryOne<{ status: string }>("select status from contact_messages where email = $1", [email]);
      expect(saved!.status).toBe("READ");
    }).toPass({ timeout: 10_000 });

    await withDb((client) => client.query("delete from contact_messages where email = $1", [email]));
  });
});

test.describe("data export", () => {
  test("offers a CSV for every category of customer data", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/data-export");

    const cards = page.locator(".export-grid .admin-card");
    await expect(cards).toHaveCount(5);
    const titles = await cards.locator("h3").allTextContents();
    expect(titles).toEqual(["Customer Accounts", "Orders", "Saved Addresses", "Wishlist", "Reviews"]);
  });

  test("downloads real CSVs with the right headers and no password hashes", async ({ page }) => {
    await loginAsAdmin(page);

    const expected: Record<string, string[]> = {
      customers: ["Name", "Email"],
      orders: ["Order Number"],
      addresses: ["City"],
      wishlist: ["Product"],
      reviews: ["Rating"],
    };

    for (const [name, mustContain] of Object.entries(expected)) {
      const res = await page.request.get(`/api/admin/export/${name}`);
      expect(res.ok(), `${name} export failed`).toBeTruthy();
      expect(res.headers()["content-type"]).toContain("csv");
      const body = await res.text();
      const header = body.split("\n")[0];
      for (const column of mustContain) expect(header).toContain(column);
      // A password hash must never leave the database.
      expect(body.toLowerCase()).not.toContain("password");
      expect(body).not.toContain("$2b$");
    }
  });

  test("escapes commas and quotes so columns never shift", async ({ page }) => {
    // A customer whose name would break a naive CSV writer.
    const email = uniqueEmail("csv");
    await withDb((client) =>
      client.query(
        `insert into customers (id, email, password_hash, name, phone)
         values (gen_random_uuid()::text, $1, 'not-a-real-hash', $2, '9876500000')`,
        [email, 'Ravi "The Tailor" Kumar, Jr.']
      )
    );

    await loginAsAdmin(page);
    const res = await page.request.get("/api/admin/export/customers");
    const body = await res.text();
    const line = body.split("\n").find((l) => l.includes(email))!;
    expect(line).toContain('"Ravi ""The Tailor"" Kumar, Jr."');
    // The row still has the same number of columns as the header.
    expect(countCsvFields(line)).toBe(countCsvFields(body.split("\n")[0]));

    await withDb((client) => client.query("delete from customers where email = $1", [email]));
  });
});

/** Count top-level comma-separated fields, respecting quoted sections. */
function countCsvFields(line: string): number {
  let fields = 1;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields++;
    }
  }
  return fields;
}
