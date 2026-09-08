// The pages a visitor lands on before they shop: home, the style guides, and
// the three static pages. Mostly checking that real content renders and the
// navigation actually goes where it says.

import { test, expect } from "@playwright/test";

test.describe("home page", () => {
  test("shows the hero, the three category cards and real products", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toContainText("Wear the woman");
    await expect(page.locator(".hero-cta a", { hasText: "Shop the Edit" })).toHaveAttribute("href", "/shop");

    const categories = page.locator(".category-grid .category-card");
    await expect(categories).toHaveCount(3);
    await expect(categories.nth(0)).toHaveAttribute("href", "/shop?cat=Everyday");
    await expect(categories.nth(1)).toHaveAttribute("href", "/shop?cat=Office");
    await expect(categories.nth(2)).toHaveAttribute("href", "/shop?cat=Occasion");
    // Each card must render an image, not an empty box.
    await expect(categories.nth(0).locator("img")).toBeVisible();

    // Every style guide is linked from the homepage.
    await expect(page.locator(".mood-grid .mood-card")).toHaveCount(10);

    const featured = page.locator(".product-grid .product-card");
    expect(await featured.count()).toBeGreaterThan(0);
    await expect(featured.first().locator(".p-name")).not.toBeEmpty();
    await expect(featured.first().locator("img")).toBeVisible();
  });

  test("the header cart badge is hidden until something is in the bag", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('.icon-btn[aria-label="Cart"]')).toBeVisible();
    await expect(page.locator(".cart-count")).toBeHidden();
  });

  test("category cards lead to a filtered shop page", async ({ page }) => {
    await page.goto("/");
    await page.locator('.category-card[href="/shop?cat=Occasion"]').click();
    await expect(page).toHaveURL(/\/shop\?cat=Occasion/);
    await expect(page.locator(".page-hero h1")).toHaveText("Occasion");
  });
});

test.describe("style guides", () => {
  test("a guide page shows its four tips and a shoppable edit", async ({ page }) => {
    await page.goto("/style/the-big-meeting");

    await expect(page.locator(".page-hero h1")).toContainText("Big Meeting");
    await expect(page.locator(".guide-tip-card")).toHaveCount(4);
    await expect(page.locator(".guide-tip-card").first().locator("h4")).not.toBeEmpty();

    // Either real products or the honest "curating this edit" message —
    // never a silently empty grid.
    const products = page.locator(".product-grid .product-card");
    const empty = page.locator(".empty-state");
    expect((await products.count()) > 0 || (await empty.count()) > 0).toBe(true);

    // And it cross-links to the other nine.
    await expect(page.locator(".mood-grid .mood-card")).toHaveCount(9);
  });

  test("an unknown guide 404s rather than rendering an empty page", async ({ page }) => {
    const res = await page.goto("/style/not-a-real-guide");
    expect(res?.status()).toBe(404);
  });
});

test.describe("static pages", () => {
  test("Our Story renders the founders' copy", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("h1")).toContainText("Two women");
    await expect(page.locator(".her-editions .her-edition")).toHaveCount(5);
  });

  test("Shipping & Returns quotes the one shared free-delivery threshold", async ({ page }) => {
    await page.goto("/shipping-returns");
    await expect(page.locator("h1")).toHaveText("Shipping & Returns");
    // This number is repeated across cart, checkout, product page and here —
    // it drifted out of sync once before.
    const cards = page.locator(".contact-card");
    await expect(cards.filter({ hasText: "Shipping & Delivery" })).toContainText("₹5,000");
    await expect(cards.filter({ hasText: "Exchanges & Returns" })).toContainText("7 days");
  });

  test("the contact form sends a message and confirms it", async ({ page }) => {
    await page.goto("/contact");
    await page.fill('input[name="name"]', "Playwright Visitor");
    await page.fill('input[name="email"]', "visitor@test.example.com");
    await page.fill('textarea[name="message"]', "Is the olive palazzo set available in XL?");
    await page.click('button[type="submit"]');

    await expect(page.locator("form p")).toContainText("Thank you", { timeout: 15000 });
  });

  test("footer and header navigation point at the real pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-nav a", { hasText: "Shop All" })).toHaveAttribute("href", "/shop");
    await expect(page.locator('.site-footer a[href="/shipping-returns"]')).toBeVisible();
    await expect(page.locator('.site-footer a[aria-label="WhatsApp"]')).toHaveAttribute(
      "href",
      "https://wa.me/919538559595"
    );
  });
});
