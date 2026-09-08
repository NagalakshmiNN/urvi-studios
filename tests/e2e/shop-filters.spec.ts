// The Shop page: category chips, sorting, and the Fabric/Color/Size refine
// chips — including that they combine with each other rather than replacing
// one another, which is the whole point of them.

import { test, expect } from "@playwright/test";
import { createTestProduct, deleteTestProduct } from "../setup/db";

type Product = Awaited<ReturnType<typeof createTestProduct>>;
const created: Product[] = [];

test.beforeAll(async () => {
  // Two products with deliberately distinctive, unique attributes so the
  // refine chips have something unambiguous to match on.
  created.push(
    await createTestProduct({
      name: "Filter Test Linen Piece",
      fabric: "Zzz Test Linen",
      colors: [{ name: "Zzz Test Teal", hex: "#1d4e89" }],
      sizes: ["S", "M"],
      categorySlug: "casual-wear",
      price: 1999,
      stock: 6,
    }),
    await createTestProduct({
      name: "Filter Test Silk Piece",
      fabric: "Zzz Test Silk",
      colors: [{ name: "Zzz Test Rust", hex: "#a5333a" }],
      sizes: ["L", "XL"],
      categorySlug: "festive-wear",
      price: 4999,
      stock: 6,
    })
  );
});

test.afterAll(async () => {
  for (const p of created) await deleteTestProduct(p.id);
});

test("lists the catalog with a piece count that matches the grid", async ({ page }) => {
  await page.goto("/shop");
  const cards = page.locator(".product-grid .product-card");
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  await expect(page.locator(".toolbar")).toContainText(`${count} pieces`);
});

test("filters by category section and by individual category", async ({ page }) => {
  await page.goto("/shop");
  const all = await page.locator(".product-card").count();

  await page.locator(".filter-bar a.chip", { hasText: "Occasion" }).first().click();
  await expect(page).toHaveURL(/cat=Occasion/);
  const occasion = await page.locator(".product-card").count();
  expect(occasion).toBeGreaterThan(0);
  expect(occasion).toBeLessThan(all);
  // Every card left really is in an Occasion category.
  const cats = await page.locator(".product-card .p-cat").allTextContents();
  for (const c of cats) expect(["Festive Wear", "Fusion Edit"]).toContain(c.trim());

  await page.locator(".filter-bar a.chip", { hasText: "Casual Wear" }).first().click();
  await expect(page).toHaveURL(/sub=casual-wear/);
  for (const c of await page.locator(".product-card .p-cat").allTextContents()) {
    expect(c.trim()).toBe("Casual Wear");
  }
});

test("sorts by price in both directions", async ({ page }) => {
  await page.goto("/shop?sort=price-asc");
  const asc = await priceList(page);
  expect(asc).toEqual([...asc].sort((a, b) => a - b));

  await page.goto("/shop?sort=price-desc");
  const desc = await priceList(page);
  expect(desc).toEqual([...desc].sort((a, b) => b - a));
});

test.describe("refine chips", () => {
  test("offers Size, Color and Fabric options drawn from the catalog", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.locator(".refine-bar")).toBeVisible();
    await expect(page.locator(".refine-group", { hasText: "Size" }).first()).toBeVisible();
    await expect(page.locator(".refine-group", { hasText: "Color" }).first()).toBeVisible();
    await expect(page.locator(".refine-group", { hasText: "Fabric" }).first()).toBeVisible();

    // Colour chips carry their actual swatch, not just a name.
    await expect(page.locator(".chip-color .chip-color-dot").first()).toBeVisible();
  });

  test("a fabric chip narrows the grid, and clicking it again clears it", async ({ page }) => {
    await page.goto("/shop");
    const before = await page.locator(".product-card").count();

    const chip = page.locator(".refine-group", { hasText: "Fabric" }).locator(".chip-sm", {
      hasText: "Zzz Test Linen",
    });
    await chip.click();

    await expect(page).toHaveURL(/fabric=/);
    await expect(page.locator(".product-card")).toHaveCount(1);
    await expect(page.locator(".p-name")).toHaveText("Filter Test Linen Piece");
    await expect(page.locator(".chip-sm.active", { hasText: "Zzz Test Linen" })).toBeVisible();

    // Clicking the active chip toggles it back off.
    await page.locator(".chip-sm.active", { hasText: "Zzz Test Linen" }).click();
    await expect(page.locator(".product-card")).toHaveCount(before);
  });

  test("size and colour combine instead of replacing each other", async ({ page }) => {
    await page.goto("/shop");

    await page.locator(".refine-group", { hasText: "Size" }).locator(".chip-sm", { hasText: "XL" }).first().click();
    await expect(page).toHaveURL(/size=XL/);
    await page.locator(".refine-group", { hasText: "Color" }).locator(".chip-sm", { hasText: "Zzz Test Rust" }).click();
    await expect(page).toHaveURL(/color=Zzz/);

    const url = new URL(page.url());
    expect(url.searchParams.get("size")).toBe("XL");
    expect(url.searchParams.get("color")).toBe("Zzz Test Rust");

    await expect(page.locator(".product-card")).toHaveCount(1);
    await expect(page.locator(".p-name")).toHaveText("Filter Test Silk Piece");
    await expect(page.locator(".chip-sm.active")).toHaveCount(2);
  });

  test("refine options follow the category you're in", async ({ page }) => {
    // The silk piece is filed under Festive Wear, so its fabric should not be
    // on offer while browsing Casual Wear.
    await page.goto("/shop?sub=casual-wear");
    const fabricChips = page.locator(".refine-group", { hasText: "Fabric" }).locator(".chip-sm");
    await expect(fabricChips.filter({ hasText: "Zzz Test Linen" })).toHaveCount(1);
    await expect(fabricChips.filter({ hasText: "Zzz Test Silk" })).toHaveCount(0);
  });

  test("Clear filters resets the refinements but keeps the category", async ({ page }) => {
    await page.goto("/shop?sub=casual-wear");
    await page.locator(".refine-group", { hasText: "Fabric" }).locator(".chip-sm", { hasText: "Zzz Test Linen" }).click();
    await expect(page.locator(".refine-clear")).toBeVisible();

    await page.locator(".refine-clear").click();
    // The address bar updates a beat after the click (client-side routing).
    await expect(page).not.toHaveURL(/fabric=/);
    const url = new URL(page.url());
    expect(url.searchParams.get("fabric")).toBeNull();
    expect(url.searchParams.get("sub")).toBe("casual-wear");
    await expect(page.locator(".chip-sm.active")).toHaveCount(0);
  });

  test("a combination with no matches shows the empty message, not a blank page", async ({ page }) => {
    await page.goto("/shop?fabric=Zzz%20Test%20Linen&size=XL");
    await expect(page.locator(".empty-state")).toContainText("No pieces match this filter");
    await expect(page.locator(".product-card")).toHaveCount(0);
  });

  test("refinements survive a sort change", async ({ page }) => {
    await page.goto("/shop?fabric=Zzz%20Test%20Linen");
    await page.locator(".toolbar a.chip", { hasText: "Price: Low to High" }).click();
    await expect(page).toHaveURL(/sort=price-asc/);
    const url = new URL(page.url());
    expect(url.searchParams.get("fabric")).toBe("Zzz Test Linen");
    expect(url.searchParams.get("sort")).toBe("price-asc");
  });
});

/**
 * The live price of each card. `.p-price` can also contain a struck-through
 * compare-at price, so take the first ₹ figure only.
 */
async function priceList(page: import("@playwright/test").Page): Promise<number[]> {
  const texts = await page.locator(".product-card .p-price").allTextContents();
  return texts.map((t) => {
    const match = t.match(/₹([\d,]+)/);
    if (!match) throw new Error(`No price found in "${t}"`);
    return Number(match[1].replace(/,/g, ""));
  });
}
