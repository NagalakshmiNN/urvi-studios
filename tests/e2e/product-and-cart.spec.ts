// The product page (photo gallery, per-size stock, add to bag, rich-text
// description) and the cart it feeds.

import { test, expect } from "@playwright/test";
import { createTestProduct, deleteTestProduct, withDb } from "../setup/db";
import { seedCart } from "../setup/fixtures";

type Product = Awaited<ReturnType<typeof createTestProduct>>;

let multiPhoto: Product;
let singlePhoto: Product;
let partlySoldOut: Product;

test.beforeAll(async () => {
  multiPhoto = await createTestProduct({
    name: "Gallery Test Gown",
    price: 4200,
    stock: 9,
    images: ["/placeholders/festive-wear.svg", "/placeholders/kurta.svg", "/placeholders/fusion-edit.svg"],
    description: "<p>A <strong>hand-finished</strong> gown.</p><p>Second paragraph.</p>",
  });

  singlePhoto = await createTestProduct({
    name: "Single Photo Kurta",
    price: 1800,
    stock: 6,
    // Written before the rich-text editor existed — still plain text in the
    // database, and it must not render as one run-on block.
    description: "First paragraph of an old description.\n\nSecond paragraph.",
  });

  partlySoldOut = await createTestProduct({ name: "Partly Sold Out Set", price: 2600, stock: 6, sizes: ["S", "M", "L"] });
  // S sold out, M down to its last two.
  await withDb(async (client) => {
    await client.query("update product_sizes set stock = 0 where product_id = $1 and label = 'S'", [partlySoldOut.id]);
    await client.query("update product_sizes set stock = 2 where product_id = $1 and label = 'M'", [partlySoldOut.id]);
  });
});

test.afterAll(async () => {
  for (const p of [multiPhoto, singlePhoto, partlySoldOut]) await deleteTestProduct(p.id);
});

test.describe("product page", () => {
  test("shows every uploaded photo as a thumbnail and swaps the main image", async ({ page }) => {
    await page.goto(`/product/${multiPhoto.slug}`);

    await expect(page.locator(".pdp-gallery > img")).toBeVisible();
    const thumbs = page.locator(".pdp-thumb");
    await expect(thumbs).toHaveCount(3);

    const mainBefore = await page.locator(".pdp-gallery > img").getAttribute("src");
    await thumbs.nth(2).click();
    await expect(page.locator(".pdp-gallery > img")).not.toHaveAttribute("src", mainBefore ?? "");
    await expect(thumbs.nth(2)).toHaveClass(/selected/);
  });

  test("shows no thumbnail strip when there is only one photo", async ({ page }) => {
    await page.goto(`/product/${singlePhoto.slug}`);
    await expect(page.locator(".pdp-gallery > img")).toBeVisible();
    await expect(page.locator(".pdp-thumbs")).toHaveCount(0);
  });

  test("renders a rich-text description as real formatting, not escaped markup", async ({ page }) => {
    await page.goto(`/product/${multiPhoto.slug}`);
    await expect(page.locator(".pdp-desc strong")).toHaveText("hand-finished");
    await expect(page.locator(".pdp-desc p")).toHaveCount(2);
    await expect(page.locator(".pdp-desc")).not.toContainText("<strong>");
  });

  test("renders an older plain-text description as separate paragraphs", async ({ page }) => {
    await page.goto(`/product/${singlePhoto.slug}`);
    await expect(page.locator(".pdp-desc p")).toHaveCount(2);
  });

  test("shows the Product ID and price", async ({ page }) => {
    await page.goto(`/product/${multiPhoto.slug}`);
    await expect(page.locator(".pdp-sku")).toContainText(multiPhoto.sku);
    await expect(page.locator(".pdp-price")).toContainText("₹4,200");
  });

  test("marks a sold-out size and won't let it be selected", async ({ page }) => {
    await page.goto(`/product/${partlySoldOut.slug}`);

    const soldOut = page.locator(".size-opt", { hasText: /^S$/ });
    await expect(soldOut).toHaveClass(/sold-out/);
    await soldOut.click();
    await expect(soldOut).not.toHaveClass(/selected/);
  });

  test("warns when a chosen size is down to its last few", async ({ page }) => {
    await page.goto(`/product/${partlySoldOut.slug}`);
    await page.locator(".size-opt", { hasText: /^M$/ }).click();
    await expect(page.locator(".pdp-stock")).toContainText("Only 2 left in size M");
  });

  test("adding to the bag updates the header count", async ({ page }) => {
    await page.goto(`/product/${multiPhoto.slug}`);
    await expect(page.locator(".cart-count")).toBeHidden();

    await page.locator("button.btn-primary", { hasText: "Add to Bag" }).click();
    await expect(page.locator(".cart-count")).toBeVisible();
    await expect(page.locator(".cart-count")).toHaveText("1");
  });

  test("quick-add from a shop card works too", async ({ page }) => {
    await page.goto("/shop");
    await page.locator(".product-card", { hasText: "Gallery Test Gown" }).locator("button.add-link").click();
    await expect(page.locator(".cart-count")).toHaveText("1");
  });
});

test.describe("cart", () => {
  function line(p: Product, qty = 1, size = "M") {
    return {
      productId: p.id,
      sku: p.sku,
      slug: p.slug,
      name: p.name,
      price: p.price,
      image: "/placeholders/casual-wear.svg",
      size,
      color: p.colors[0].name,
      qty,
    };
  }

  test("shows an empty bag honestly", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.locator(".cart-layout")).toBeVisible();
    await expect(page.locator(".empty-state h3")).toHaveText("Your bag is empty");
    // Checkout is a disabled button, not a live link, when there's nothing to buy.
    await expect(page.getByRole("button", { name: "Proceed to Checkout" })).toBeDisabled();
  });

  test("totals up the bag and shows GST as included, not added on", async ({ page }) => {
    await seedCart(page, [line(multiPhoto, 1), line(singlePhoto, 2)]);
    await page.goto("/cart");
    await expect(page.locator(".cart-layout")).toBeVisible();

    await expect(page.locator(".cart-item")).toHaveCount(2);
    const subtotal = 4200 + 1800 * 2; // ₹7,800
    await expect(page.locator(".summary-row.total")).toContainText("₹7,800");

    // GST is inside that number, so it must be smaller than the total.
    const gstText = await page.locator(".summary-row", { hasText: "GST" }).textContent();
    const gst = Number((gstText ?? "").match(/₹([\d,]+)/)?.[1].replace(/,/g, "") ?? "0");
    expect(gst).toBeGreaterThan(0);
    expect(gst).toBeLessThan(subtotal);

    // Over ₹5,000, so delivery is free.
    await expect(page.locator(".summary-row", { hasText: "Delivery" })).toContainText("Free");
  });

  test("says delivery is extra below the free-delivery threshold", async ({ page }) => {
    await seedCart(page, [line(singlePhoto, 1)]);
    await page.goto("/cart");
    await expect(page.locator(".summary-row", { hasText: "Delivery" })).toContainText("Additional");
    await expect(page.locator(".summary-card")).toContainText("₹5,000");
  });

  test("changing quantity and removing a line updates the total", async ({ page }) => {
    await seedCart(page, [line(singlePhoto, 1)]);
    await page.goto("/cart");
    await expect(page.locator(".cart-layout")).toBeVisible();
    await expect(page.locator(".summary-row.total")).toContainText("₹1,800");

    await page.locator(".cart-item .qty-stepper button").nth(1).click(); // +
    await expect(page.locator(".summary-row.total")).toContainText("₹3,600");

    await page.locator(".cart-item .qty-stepper button").nth(0).click(); // –
    await expect(page.locator(".summary-row.total")).toContainText("₹1,800");

    await page.locator(".cart-item .remove").click();
    await expect(page.locator(".empty-state h3")).toHaveText("Your bag is empty");
  });

  test("quantity never drops below one", async ({ page }) => {
    await seedCart(page, [line(singlePhoto, 1)]);
    await page.goto("/cart");
    await page.locator(".cart-item .qty-stepper button").nth(0).click();
    await expect(page.locator(".cart-item .qty-stepper span")).toHaveText("1");
  });

  test("shows the Product ID on each line, for fulfilment", async ({ page }) => {
    await seedCart(page, [line(multiPhoto, 1)]);
    await page.goto("/cart");
    await expect(page.locator(".cart-item")).toContainText(multiPhoto.sku);
  });

  test("offers guest checkout to a logged-out shopper", async ({ page }) => {
    await seedCart(page, [line(singlePhoto, 1)]);
    await page.goto("/cart");
    await expect(page.locator(".summary-card")).toContainText("checkout as a guest");
    await expect(page.getByRole("link", { name: "Proceed to Checkout" })).toHaveAttribute("href", "/checkout");
  });
});
