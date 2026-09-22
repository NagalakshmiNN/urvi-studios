// Signing out has to empty the bag.
//
// The session is a cookie the server clears; the bag is localStorage, which
// the server cannot touch. Before this, logging out left the previous
// person's chosen pieces in the cart and their count in the header — on a
// shared laptop, a stranger seeing what you had been shopping for.

import { test, expect } from "@playwright/test";
import { createTestProduct, deleteTestProduct, deleteCustomerByEmail } from "../setup/db";
import { registerCustomer } from "../setup/fixtures";

type Product = Awaited<ReturnType<typeof createTestProduct>>;
let product: Product;

test.beforeAll(async () => {
  product = await createTestProduct({ name: "Logout Cart Product", price: 1500, stock: 5 });
});

test.afterAll(async () => {
  await deleteTestProduct(product.id);
});

test("logging out empties the cart, and it stays empty", async ({ page }) => {
  const { email } = await registerCustomer(page, { name: "Cart Leaver" });

  // Put something in the bag the way a customer does.
  await page.goto(`/product/${product.slug}`);
  await page.locator("button.btn-primary", { hasText: "Add to Bag" }).first().click();

  await page.goto("/cart");
  await expect(page.getByText("Logout Cart Product").first()).toBeVisible();

  await page.goto("/account");
  await page.getByRole("button", { name: /logout/i }).click();
  await page.waitForURL(/\/$/);

  // Empty, and still empty after a fresh load — which is what proves it was
  // cleared from storage rather than merely re-rendered.
  await page.goto("/cart");
  await expect(page.getByText("Logout Cart Product")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Logout Cart Product")).toHaveCount(0);

  await deleteCustomerByEmail(email);
});
