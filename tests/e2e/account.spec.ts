// Registering, logging in, the protected account area, wishlist and saved
// addresses.

import { test, expect } from "@playwright/test";
import { createTestProduct, deleteTestProduct, deleteCustomerByEmail, query, uniqueEmail } from "../setup/db";
import { registerCustomer, loginAsCustomer } from "../setup/fixtures";

type Product = Awaited<ReturnType<typeof createTestProduct>>;
let product: Product;

test.beforeAll(async () => {
  product = await createTestProduct({ name: "Wishlist Test Piece", price: 2200, stock: 8 });
});

test.afterAll(async () => {
  await deleteTestProduct(product.id);
});

test.describe("registering and signing in", () => {
  test("a new shopper can register and lands in their account", async ({ page }) => {
    const email = uniqueEmail("newbie");
    await page.goto("/account/register");
    await page.fill('input[name="name"]', "Asha Menon");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="phone"]', "9876500777");
    await page.fill('input[name="password"]', "GoodPassword123");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.locator("h1")).toContainText("Welcome, Asha");
    await expect(page.locator(".notice-box")).toContainText(email);
    await expect(page.locator(".empty-state h3")).toHaveText("No orders yet");

    await deleteCustomerByEmail(email);
  });

  test("refuses a second account on the same email", async ({ page }) => {
    const { email } = await registerCustomer(page);

    // Sign out, then try to register the same email again.
    await page.context().clearCookies();
    await page.goto("/account/register");
    await page.fill('input[name="name"]', "Impostor");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "AnotherPass123");
    await page.click('button[type="submit"]');

    await expect(page.locator(".notice-box.error")).toContainText("already exists");
    await deleteCustomerByEmail(email);
  });

  test("rejects a wrong password and an unknown email", async ({ page }) => {
    const { email, password } = await registerCustomer(page);
    await page.context().clearCookies();

    await page.goto("/account/login");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "definitely-wrong");
    await page.click('button[type="submit"]');
    await expect(page.locator(".notice-box.error")).toHaveText("Incorrect password.");

    await page.fill('input[name="email"]', "nobody@test.example.com");
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page.locator(".notice-box.error")).toHaveText("No account found with that email.");

    await deleteCustomerByEmail(email);
  });

  test("logging out ends the session", async ({ page }) => {
    const { email } = await registerCustomer(page);
    await page.goto("/account");
    await page.locator(".account-nav-logout").click();
    await expect(page).toHaveURL(/\/$/);

    // The account area is closed again.
    await page.goto("/account/orders");
    await expect(page).toHaveURL(/\/account\/login/);
    await deleteCustomerByEmail(email);
  });
});

test.describe("the account area is private", () => {
  const guarded = ["/account", "/account/orders", "/account/wishlist", "/account/addresses"];

  for (const path of guarded) {
    test(`${path} sends a logged-out visitor to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/account/login\\?next=${encodeURIComponent(path)}`));
    });
  }

  test("another shopper's order is a 404, not someone else's data", async ({ page }) => {
    const { email: ownerEmail } = await registerCustomer(page);
    // Give the first shopper an order.
    const res = await page.request.post("/api/checkout/create-order", {
      data: {
        items: [{ productId: product.id, size: "M", color: product.colors[0].name, qty: 1 }],
        customer: {
          name: "Order Owner",
          email: ownerEmail,
          phone: "9876500888",
          address: "1 Owner Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
      },
    });
    const { orderNumber } = await res.json();

    // A different shopper must not be able to open it.
    await page.context().clearCookies();
    const { email: otherEmail } = await registerCustomer(page);
    const response = await page.goto(`/account/orders/${orderNumber}`);
    expect(response?.status()).toBe(404);

    await deleteCustomerByEmail(ownerEmail);
    await deleteCustomerByEmail(otherEmail);
  });
});

test.describe("wishlist", () => {
  test("saving a piece keeps it on the wishlist page", async ({ page }) => {
    const { email } = await registerCustomer(page);

    // Scoped to the product's own heart — related-product cards have one too.
    await page.goto(`/product/${product.slug}`);

    // The heart fills in optimistically, before the save actually lands, so
    // wait for the request itself rather than the class.
    const [saved] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/wishlist") && r.request().method() === "POST"),
      page.locator(".pdp-info button.wishlist-btn").click(),
    ]);
    expect(saved.ok()).toBeTruthy();
    await expect(page.locator(".pdp-info button.wishlist-btn")).toHaveClass(/active/);

    await page.goto("/account/wishlist");
    await expect(page.locator(".product-card")).toHaveCount(1);
    await expect(page.locator(".p-name")).toHaveText("Wishlist Test Piece");

    // And removing it empties the page again.
    const [removed] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/wishlist") && r.request().method() === "DELETE"),
      page.locator(".product-card button.wishlist-btn").click(),
    ]);
    expect(removed.ok()).toBeTruthy();
    await page.reload();
    await expect(page.locator(".empty-state h3")).toHaveText("Your wishlist is empty");

    await deleteCustomerByEmail(email);
  });

  test("a logged-out visitor is asked to login first", async ({ page }) => {
    await page.goto(`/product/${product.slug}`);
    await page.locator(".pdp-info button.wishlist-btn").click();
    await expect(page).toHaveURL(/\/account\/login\?next=/);
  });
});

test.describe("saved addresses", () => {
  test("adding an address stores it and marks the first one default", async ({ page }) => {
    const { email } = await registerCustomer(page);
    await page.goto("/account/addresses");

    await page.fill('input[name="phone"]', "9876500999");
    await page.fill('input[name="line1"]', "42 Test Avenue");
    await page.fill('input[name="city"]', "Bengaluru");
    await page.fill('input[name="state"]', "Karnataka");
    await page.fill('input[name="pincode"]', "560002");
    await page.locator('button[type="submit"]', { hasText: "Save Address" }).click();

    await expect(page.locator(".address-card")).toHaveCount(1);
    await expect(page.locator(".address-card")).toContainText("42 Test Avenue");
    await expect(page.locator(".address-default-tag")).toBeVisible();

    const rows = await query("select id from addresses where line1 = $1", ["42 Test Avenue"]);
    expect(rows).toHaveLength(1);

    await deleteCustomerByEmail(email);
  });

  test("refuses a pincode that isn't six digits", async ({ page }) => {
    const { email } = await registerCustomer(page);
    await page.goto("/account/addresses");

    await page.fill('input[name="phone"]', "9876500999");
    await page.fill('input[name="line1"]', "Bad Pincode Lane");
    await page.fill('input[name="city"]', "Bengaluru");
    await page.fill('input[name="state"]', "Karnataka");
    await page.fill('input[name="pincode"]', "12");
    await page.locator('button[type="submit"]', { hasText: "Save Address" }).click();

    await expect(page.locator(".notice-box.error")).toContainText("6-digit pincode");
    await deleteCustomerByEmail(email);
  });
});
