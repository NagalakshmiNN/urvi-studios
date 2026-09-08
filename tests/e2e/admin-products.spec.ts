// The admin product screens: the login gate, inline edits on the list,
// adding a product with photos and per-size stock, editing one, and deleting
// one that has already been ordered.

import { test, expect } from "@playwright/test";
import {
  createTestProduct,
  deleteTestProduct,
  deleteOrderByNumber,
  deleteCustomerByEmail,
  getProductBySlug,
  getSizeStock,
  query,
  queryOne,
  uniqueEmail,
  withDb,
} from "../setup/db";
import { loginAsAdmin } from "../setup/fixtures";

// A 1×1 PNG, enough to exercise the real upload path end to end.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

test.describe("the admin area is locked", () => {
  for (const path of ["/admin", "/admin/products", "/admin/orders", "/admin/coupons", "/admin/data-export"]) {
    test(`${path} sends a logged-out visitor to the admin login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login/);
    });
  }

  test("a wrong password is refused", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill('input[name="email"]', "admin@test.urvistudios.in");
    await page.fill('input[name="password"]', "not-the-password");
    await page.click('button[type="submit"]');
    await expect(page.locator(".notice-box.error")).toHaveText("Incorrect password.");
  });

  test("a customer login is not an admin login", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill('input[name="email"]', "nobody@test.example.com");
    await page.fill('input[name="password"]', "whatever");
    await page.click('button[type="submit"]');
    await expect(page.locator(".notice-box.error")).toHaveText("No admin account found with that email.");
  });
});

test.describe("products list", () => {
  test("shows the catalog with the costing columns", async ({ page }) => {
    const product = await createTestProduct({
      name: "Costing Columns Product",
      price: 1800,
      landedCost: 1000,
      minRoundUpTo: 1500,
      maxRoundUpTo: 1800,
    });

    await loginAsAdmin(page);
    await page.goto("/admin/products");

    const headers = await page.locator("table.admin-table thead th").allTextContents();
    expect(headers).toContain("Landed Cost");
    expect(headers).toContain("Min Round Up To");
    expect(headers).toContain("Max Round Up To");

    const row = page.locator("tbody tr", { hasText: "Costing Columns Product" });
    await expect(row.locator('input[name="landedCost"]')).toHaveValue("1000");
    await expect(row.locator('input[name="minRoundUpTo"]')).toHaveValue("1500");
    await expect(row.locator('input[name="maxRoundUpTo"]')).toHaveValue("1800");

    // The markup badge does the margin maths at a glance: 1500 over a
    // landed cost of 1000 is +50%, and 1800 is +80%.
    await expect(row).toContainText("+50%");
    await expect(row).toContainText("+80%");

    await deleteTestProduct(product.id);
  });

  test("saves price, badge, costing numbers and the active toggle inline", async ({ page }) => {
    const product = await createTestProduct({ name: "Inline Edit Product", price: 1200, landedCost: 800 });

    await loginAsAdmin(page);
    await page.goto("/admin/products");
    const row = page.locator("tbody tr", { hasText: "Inline Edit Product" });

    // The row's form is portaled to the body once React hydrates — Save is
    // disabled until then.
    const save = row.locator("button", { hasText: "Save" });
    await expect(save).toBeEnabled();

    await row.locator('input[name="price"]').fill("1499");
    await row.locator('input[name="badge"]').fill("Bestseller");
    await row.locator('input[name="landedCost"]').fill("900");
    await row.locator('input[name="minRoundUpTo"]').fill("1300");
    await row.locator('input[name="maxRoundUpTo"]').fill("1499");
    await row.locator('input[name="isActive"]').uncheck();
    await save.click();

    await expect(async () => {
      const saved = await getProductBySlug(product.slug);
      expect(saved!.price).toBe(1499);
      expect(saved!.badge).toBe("Bestseller");
      expect(saved!.landed_cost).toBe(900);
      expect(saved!.min_round_up_to).toBe(1300);
      expect(saved!.max_round_up_to).toBe(1499);
      expect(saved!.is_active).toBe(false);
    }).toPass({ timeout: 10_000 });

    // Deactivating really does take it off the storefront.
    await page.goto(`/shop`);
    await expect(page.locator(".product-card", { hasText: "Inline Edit Product" })).toHaveCount(0);

    await deleteTestProduct(product.id);
  });

  test("refuses to save an invalid price", async ({ page }) => {
    const product = await createTestProduct({ name: "Bad Price Product", price: 1000 });
    await loginAsAdmin(page);
    await page.goto("/admin/products");

    const row = page.locator("tbody tr", { hasText: "Bad Price Product" });
    await expect(row.locator("button", { hasText: "Save" })).toBeEnabled();
    await row.locator('input[name="price"]').fill("0");
    await row.locator("button", { hasText: "Save" }).click();

    await expect(row).toContainText("valid price");
    expect((await getProductBySlug(product.slug))!.price).toBe(1000);

    await deleteTestProduct(product.id);
  });
});

test.describe("adding a product", () => {
  test("creates one with a rich-text description, a real photo and per-size stock", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/products/new");

    const name = `Playwright Added Product ${Date.now().toString(36)}`;
    await page.fill('input[name="name"]', name);
    await page.selectOption('select[name="categoryId"]', { label: "Casual Wear" });

    // The rich-text box only exists after hydration.
    const editor = page.locator(".rte-content");
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type("A soft everyday piece.");
    await page.locator('button.rte-btn[title="Bold"]').click();
    await page.keyboard.type(" Bold bit.");

    await page.fill('textarea[name="fabric"]', "Test cotton");
    await page.fill('input[name="price"]', "1750");

    // A genuine upload round-trip through /api/admin/upload-image.
    await page.locator('.image-dropzone input[type="file"]').setInputFiles({
      name: "swatch.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await expect(page.locator(".image-preview-thumb")).toHaveCount(1);
    await expect(page.locator(".image-preview-primary")).toHaveText("Main");

    // Per-size stock, not one lump number.
    await page.locator('input[name="sizeLabel"]').first().fill("M");
    await page.locator('input[name="sizeStock"]').first().fill("4");
    await page.locator("button", { hasText: "+ Add Size" }).click();
    await page.locator('input[name="sizeLabel"]').nth(1).fill("L");
    await page.locator('input[name="sizeStock"]').nth(1).fill("6");

    await page.fill('input[name="colors"]', "Test Sage:#6a7444");
    await page.locator('button[type="submit"]', { hasText: "Add Product" }).click();

    await expect(page.locator(".notice-box")).toContainText("was added to the catalog");

    const saved = await queryOne<{ id: string; slug: string; description: string; stock: number }>(
      "select id, slug, description, stock from products where name = $1",
      [name]
    );
    expect(saved).not.toBeNull();
    // Bold really was stored as HTML, and the two sizes add up to the total.
    expect(saved!.description).toContain("<strong>");
    expect(saved!.stock).toBe(10);
    expect(await getSizeStock(saved!.id, "M")).toBe(4);
    expect(await getSizeStock(saved!.id, "L")).toBe(6);

    // The uploaded photo is served back from the database.
    const image = await queryOne<{ url: string }>("select url from product_images where product_id = $1", [saved!.id]);
    expect(image!.url).toMatch(/^\/api\/images\//);
    const res = await page.request.get(image!.url);
    expect(res.ok()).toBeTruthy();

    // And the whole thing shows up on the storefront.
    await page.goto(`/product/${saved!.slug}`);
    await expect(page.locator(".pdp-desc strong")).toHaveText("Bold bit.");
    await expect(page.locator(".pdp-price")).toContainText("₹1,750");

    await deleteTestProduct(saved!.id);
  });

  test("asks for the fields it needs instead of saving a half-finished product", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/products/new");

    // Everything the browser itself insists on, but no description.
    await page.fill('input[name="name"]', "Incomplete Product");
    await page.selectOption('select[name="categoryId"]', { label: "Casual Wear" });
    await page.fill('input[name="price"]', "1200");
    await page.locator('button[type="submit"]', { hasText: "Add Product" }).click();

    // An untouched rich-text box submits "<p></p>" — that must not count as
    // a description.
    await expect(page.locator(".notice-box.error")).toContainText("description");
    await expect(page.locator(".notice-box.error")).not.toContainText("photo");
  });
});

test.describe("editing a product", () => {
  test("loads current values, saves changes, and leaves untouched fields alone", async ({ page }) => {
    const product = await createTestProduct({
      name: "Editable Product",
      price: 2100,
      description: "Old plain text description.\n\nSecond paragraph.",
    });
    // A value from before these fields were removed from the form — editing
    // must not wipe it.
    await withDb((client) =>
      client.query("update products set perfect_for = $1 where id = $2", ["Brunches and long lunches", product.id])
    );

    await loginAsAdmin(page);
    await page.goto(`/admin/products/${product.id}/edit`);

    await expect(page.locator('input[name="name"]')).toHaveValue("Editable Product");
    await expect(page.locator('input[name="price"]')).toHaveValue("2100");
    // The legacy plain-text description opens as real paragraphs.
    await expect(page.locator(".rte-content p")).toHaveCount(2);

    await page.fill('input[name="name"]', "Edited Product Name");
    await page.fill('input[name="price"]', "2350");
    await page.locator('button[type="submit"]', { hasText: "Save Changes" }).click();
    await expect(page.locator(".notice-box")).toContainText("was updated");

    const saved = await getProductBySlug(product.slug);
    expect(saved!.name).toBe("Edited Product Name");
    expect(saved!.price).toBe(2350);
    expect(saved!.perfect_for).toBe("Brunches and long lunches");

    await deleteTestProduct(product.id);
  });
});

test.describe("deleting a product", () => {
  test("deletes one that has never been ordered", async ({ page }) => {
    const product = await createTestProduct({ name: "Disposable Product" });

    await loginAsAdmin(page);
    await page.goto("/admin/products");
    const row = page.locator("tbody tr", { hasText: "Disposable Product" });

    page.on("dialog", (d) => d.accept());
    await row.locator("button", { hasText: "Delete" }).click();
    await row.locator("button", { hasText: "Yes, delete" }).click();

    await expect(page.locator("tbody tr", { hasText: "Disposable Product" })).toHaveCount(0);
    expect(await getProductBySlug(product.slug)).toBeNull();
  });

  test("deletes one with order history, and the past order still reads correctly", async ({ page }) => {
    const product = await createTestProduct({ name: "Ordered Then Deleted Product", price: 3100 });
    const email = uniqueEmail("history");

    // A real order against it first.
    const res = await page.request.post("/api/checkout/create-order", {
      data: {
        items: [{ productId: product.id, size: "M", color: product.colors[0].name, qty: 1 }],
        customer: {
          name: "History Buyer",
          email,
          phone: "9876501234",
          address: "3 History Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
      },
    });
    const { orderNumber } = await res.json();

    await loginAsAdmin(page);
    await page.goto("/admin/products");
    const row = page.locator("tbody tr", { hasText: "Ordered Then Deleted Product" });
    page.on("dialog", (d) => d.accept());
    await row.locator("button", { hasText: "Delete" }).click();
    await row.locator("button", { hasText: "Yes, delete" }).click();
    await expect(page.locator("tbody tr", { hasText: "Ordered Then Deleted Product" })).toHaveCount(0);

    expect(await getProductBySlug(product.slug)).toBeNull();

    // The order keeps its own snapshot of what was bought.
    const lines = await query<{ product_id: string | null; product_name: string; sku: string; price: number }>(
      "select oi.product_id, oi.product_name, oi.sku, oi.price from order_items oi join orders o on o.id = oi.order_id where o.order_number = $1",
      [orderNumber]
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].product_id).toBeNull();
    expect(lines[0].product_name).toBe("Ordered Then Deleted Product");
    expect(lines[0].price).toBe(3100);

    // And the admin order page still renders it.
    await page.goto(`/admin/orders/${orderNumber}`);
    await expect(page.locator(".admin-table")).toContainText("Ordered Then Deleted Product");

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });
});
