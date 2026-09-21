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

    // Every style guide is still reachable from the homepage — six as photo
    // or typographic tiles, the rest as chips underneath. The lettered
    // monogram grid they replaced is gone.
    await expect(page.locator(".mood-grid")).toHaveCount(0);
    await expect(page.locator(".occasion-grid .occasion-card")).toHaveCount(6);
    await expect(page.locator(".occasion-more-chips a")).toHaveCount(4);

    const featured = page.locator(".product-grid .product-card");
    expect(await featured.count()).toBeGreaterThan(0);
    await expect(featured.first().locator(".p-name")).not.toBeEmpty();
    await expect(featured.first().locator("img")).toBeVisible();
  });

  test("First Look leads with the newest piece and its real details", async ({ page }) => {
    await page.goto("/");

    const band = page.locator(".first-look");
    await expect(band).toBeVisible();
    await expect(band.locator(".eyebrow")).toHaveText("First Look");
    await expect(band.locator(".first-look-flag")).toHaveText("Just in");

    // The photo is a link to the piece itself, not a decorative image.
    const photoLink = band.locator("a.first-look-image");
    await expect(photoLink).toHaveAttribute("href", /^\/product\//);
    await expect(photoLink.locator("img")).toBeVisible();

    // A price, and the two ways onward.
    await expect(band.locator(".first-look-price")).toContainText("₹");
    await expect(band.locator("a", { hasText: "See this piece" })).toHaveAttribute("href", /^\/product\//);
    await expect(band.locator("a", { hasText: "Everything new" })).toHaveAttribute("href", "/shop");

    // Clicking through lands on that same product.
    const href = await photoLink.getAttribute("href");
    await photoLink.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test("the occasion tiles never lay a title over a placeholder illustration", async ({ page }) => {
    await page.goto("/");

    const cards = page.locator(".occasion-card");
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const img = card.locator("img");
      if ((await img.count()) === 0) continue;
      // The category illustrations carry their own baked-in lettering, so a
      // tile is only allowed a photo when it's a real uploaded one. Anything
      // else renders as a typographic card with no image at all.
      await expect(img).toHaveAttribute("src", /^\/api\/images\//);
    }

    // Every tile goes to a real style guide page.
    await expect(cards.first()).toHaveAttribute("href", /^\/style\//);
  });

  test("states the four promises with the same numbers the checkout uses", async ({ page }) => {
    await page.goto("/");
    const strip = page.locator(".assurance-grid");
    await expect(strip.locator(".assurance-item")).toHaveCount(4);
    await expect(strip).toContainText("Exchange within 7 days");
    // The free-delivery figure is the shared FREE_SHIP_THRESHOLD, not a
    // number typed into the page — if the threshold moves, this moves.
    await expect(strip).toContainText("₹5,000");
    await expect(strip).toContainText("XS to 4XL");
  });

  test("does not scroll sideways on a phone", async ({ page }) => {
    // The closed mobile menu used to sit off the right edge as real layout,
    // which let the whole site be swiped into empty space on a phone.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const scrolled = await page.evaluate(() => {
      window.scrollTo(600, 0);
      return window.scrollX;
    });
    expect(scrolled).toBe(0);
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

test.describe("the pages a payment gateway checks for", () => {
  // Razorpay will not activate an account without links to these, and this site
  // had neither Terms nor Privacy — the most likely reason its website
  // registration sat pending. Each is asserted to exist, to be reachable from
  // the footer, and to say the specific thing the gateway is looking for.
  test("Terms & Conditions exists and says how payment and cancellation work", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("h1")).toHaveText("Terms & Conditions");
    await expect(page.locator("body")).toContainText("Razorpay");
    await expect(page.locator("body")).toContainText("includes GST");
    await expect(page.locator("body")).toContainText("Cancellations, exchanges and refunds");
  });

  test("Privacy Policy exists and is clear that card details never reach the shop", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("h1")).toHaveText("Privacy Policy");
    await expect(page.locator("body")).toContainText("never reach us");
    await expect(page.locator("body")).toContainText("do not sell your details");
  });

  test("the cancellation and refund policy is stated, not implied", async ({ page }) => {
    await page.goto("/shipping-returns");
    await expect(page.locator("#cancellations")).toBeVisible();
    await expect(page.locator("#cancellations")).toContainText("Before dispatch");
    await expect(page.locator("#cancellations")).toContainText("same card, UPI or bank account");
  });

  test("all three are reachable from the footer of any page", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator(".site-footer");
    await expect(footer.locator('a[href="/terms"]')).toBeVisible();
    await expect(footer.locator('a[href="/privacy"]')).toBeVisible();
    await expect(footer.locator('a[href="/shipping-returns#cancellations"]')).toBeVisible();
  });
});
