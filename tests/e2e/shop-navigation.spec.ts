// Navigation ↔ filter-bar synchronisation tests.
//
// These verify the two-tier category filter (parent → sub-category), the
// nav-bar highlight, and the removal of Two-Piece / Three-Piece from the UI.
// Run on every push so regressions in the shop-page filter wiring are caught
// before they reach production.

import { test, expect } from "@playwright/test";
import { createTestProduct, deleteTestProduct } from "../setup/db";

type Product = Awaited<ReturnType<typeof createTestProduct>>;
const created: Product[] = [];

test.beforeAll(async () => {
  // Three products, one in each parent category, with unique names so the
  // tests can assert which ones are visible without interference from the
  // live catalogue.
  created.push(
    await createTestProduct({
      name: "NavTest Everyday Tee",
      fabric: "Cotton",
      colors: [{ name: "NavTest Ivory", hex: "#faf0e6" }],
      sizes: ["S", "M"],
      categorySlug: "casual-wear",   // parent: Everyday
      price: 1299,
      stock: 5,
    }),
    await createTestProduct({
      name: "NavTest Office Blazer",
      fabric: "Polyester Blend",
      colors: [{ name: "NavTest Charcoal", hex: "#333333" }],
      sizes: ["M", "L"],
      categorySlug: "office-wear",   // parent: Office
      price: 3499,
      stock: 3,
    }),
    await createTestProduct({
      name: "NavTest Occasion Lehenga",
      fabric: "Silk",
      colors: [{ name: "NavTest Maroon", hex: "#800000" }],
      sizes: ["L", "XL"],
      categorySlug: "festive-wear",  // parent: Occasion
      price: 6999,
      stock: 2,
    })
  );
});

test.afterAll(async () => {
  for (const p of created) await deleteTestProduct(p.id);
});

// ---------------------------------------------------------------------------
// 1. Parent category navigation
// ---------------------------------------------------------------------------

test.describe("parent category chips", () => {
  test("clicking Everyday shows only Everyday products and highlights the chip", async ({ page }) => {
    await page.goto("/shop");
    await page.locator(".filter-bar a.chip", { hasText: "Everyday" }).first().click();

    await expect(page).toHaveURL(/cat=Everyday/);
    await expect(page.locator(".filter-bar a.chip.active")).toHaveText("Everyday");
    await expect(page.locator(".product-card .p-name", { hasText: "NavTest Everyday Tee" })).toBeVisible();
    await expect(page.locator(".product-card .p-name", { hasText: "NavTest Office Blazer" })).toHaveCount(0);
    await expect(page.locator(".product-card .p-name", { hasText: "NavTest Occasion Lehenga" })).toHaveCount(0);
  });

  test("clicking Office shows only Office products", async ({ page }) => {
    await page.goto("/shop");
    await page.locator(".filter-bar a.chip", { hasText: "Office" }).first().click();

    await expect(page).toHaveURL(/cat=Office/);
    await expect(page.locator(".filter-bar a.chip.active")).toHaveText("Office");
    await expect(page.locator(".product-card .p-name", { hasText: "NavTest Office Blazer" })).toBeVisible();
    await expect(page.locator(".product-card .p-name", { hasText: "NavTest Everyday Tee" })).toHaveCount(0);
  });

  test("clicking Occasion shows only Occasion products", async ({ page }) => {
    await page.goto("/shop");
    await page.locator(".filter-bar a.chip", { hasText: "Occasion" }).first().click();

    await expect(page).toHaveURL(/cat=Occasion/);
    await expect(page.locator(".filter-bar a.chip.active")).toHaveText("Occasion");
    await expect(page.locator(".product-card .p-name", { hasText: "NavTest Occasion Lehenga" })).toBeVisible();
    await expect(page.locator(".product-card .p-name", { hasText: "NavTest Everyday Tee" })).toHaveCount(0);
  });

  test("clicking All clears category and shows all products", async ({ page }) => {
    await page.goto("/shop?cat=Everyday");
    await page.locator(".filter-bar a.chip", { hasText: "All" }).first().click();

    await expect(page).not.toHaveURL(/cat=/);
    await expect(page.locator(".filter-bar a.chip.active")).toHaveText("All");
    // All three test products should be visible
    await expect(page.locator(".product-card .p-name", { hasText: "NavTest Everyday Tee" })).toBeVisible();
    await expect(page.locator(".product-card .p-name", { hasText: "NavTest Office Blazer" })).toBeVisible();
    await expect(page.locator(".product-card .p-name", { hasText: "NavTest Occasion Lehenga" })).toBeVisible();
  });

  test("switching from one parent to another replaces products", async ({ page }) => {
    await page.goto("/shop?cat=Everyday");
    await expect(page.locator(".product-card .p-name", { hasText: "NavTest Everyday Tee" })).toBeVisible();

    await page.locator(".filter-bar a.chip", { hasText: "Office" }).first().click();
    await expect(page).toHaveURL(/cat=Office/);
    await expect(page.locator(".product-card .p-name", { hasText: "NavTest Office Blazer" })).toBeVisible();
    await expect(page.locator(".product-card .p-name", { hasText: "NavTest Everyday Tee" })).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Sub-category row
// ---------------------------------------------------------------------------

test.describe("sub-category row", () => {
  test("sub-categories appear only when a parent category is selected", async ({ page }) => {
    await page.goto("/shop");
    // On "All" there should be no sub-category row (only the single filter-bar)
    const filterBars = page.locator(".filter-bar");
    await expect(filterBars).toHaveCount(1);

    // After clicking a parent, a second filter-bar appears
    await page.locator(".filter-bar a.chip", { hasText: "Everyday" }).first().click();
    await expect(page.locator(".filter-bar")).toHaveCount(2);
  });

  test("clicking a sub-category narrows to that sub-category", async ({ page }) => {
    await page.goto("/shop?cat=Everyday");
    await page.locator(".filter-bar a.chip-sm", { hasText: "Casual Wear" }).first().click();

    await expect(page).toHaveURL(/sub=casual-wear/);
    // The parent chip should still be highlighted
    await expect(page.locator(".filter-bar a.chip.active", { hasText: "Everyday" })).toBeVisible();
    // Only casual-wear products visible
    for (const text of await page.locator(".product-card .p-cat").allTextContents()) {
      expect(text.trim()).toBe("Casual Wear");
    }
  });

  test("parent chip stays highlighted when a sub-category is active", async ({ page }) => {
    await page.goto("/shop?cat=Occasion&sub=festive-wear");
    // The parent "Occasion" chip should be active
    await expect(page.locator(".filter-bar a.chip.active", { hasText: "Occasion" })).toBeVisible();
    // The sub-category chip should also be active
    await expect(page.locator(".filter-bar a.chip-sm.active", { hasText: "Festive Wear" })).toBeVisible();
  });

  test("switching parent clears the sub-category", async ({ page }) => {
    await page.goto("/shop?cat=Everyday&sub=casual-wear");
    await page.locator(".filter-bar a.chip", { hasText: "Office" }).first().click();

    await expect(page).toHaveURL(/cat=Office/);
    // sub should be gone from the URL
    const url = new URL(page.url());
    expect(url.searchParams.has("sub")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Nav bar highlight
// ---------------------------------------------------------------------------

test.describe("nav bar highlight", () => {
  test("Everyday nav link is highlighted when cat=Everyday", async ({ page }) => {
    await page.goto("/shop?cat=Everyday");
    await expect(page.locator("nav a.active", { hasText: "Everyday" })).toBeVisible();
    await expect(page.locator("nav a.active", { hasText: "Shop All" })).toHaveCount(0);
  });

  test("Office nav link is highlighted when cat=Office", async ({ page }) => {
    await page.goto("/shop?cat=Office");
    await expect(page.locator("nav a.active", { hasText: "Office" })).toBeVisible();
  });

  test("Occasion nav link is highlighted when cat=Occasion", async ({ page }) => {
    await page.goto("/shop?cat=Occasion");
    await expect(page.locator("nav a.active", { hasText: "Occasion" })).toBeVisible();
  });

  test("Shop All nav link is highlighted when no category is selected", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.locator("nav a.active", { hasText: "Shop All" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Two-Piece / Three-Piece exclusion
// ---------------------------------------------------------------------------

test.describe("Two-Piece and Three-Piece removed", () => {
  test("Two-Piece and Three-Piece do not appear in the filter chips", async ({ page }) => {
    await page.goto("/shop");
    // Check the "All" view
    await expect(page.locator(".filter-bar a.chip", { hasText: /Two.?Piece/i })).toHaveCount(0);
    await expect(page.locator(".filter-bar a.chip", { hasText: /Three.?Piece/i })).toHaveCount(0);
  });

  test("Two-Piece and Three-Piece do not appear in sub-category rows", async ({ page }) => {
    // Check each parent category's sub-category row
    for (const parent of ["Everyday", "Office", "Occasion"]) {
      await page.goto(`/shop?cat=${parent}`);
      await expect(page.locator(".filter-bar a.chip-sm", { hasText: /Two.?Piece/i })).toHaveCount(0);
      await expect(page.locator(".filter-bar a.chip-sm", { hasText: /Three.?Piece/i })).toHaveCount(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Filter persistence across category changes
// ---------------------------------------------------------------------------

test.describe("filters and categories work together", () => {
  test("sort order is preserved when switching categories", async ({ page }) => {
    await page.goto("/shop?cat=Everyday&sort=price-asc");
    await page.locator(".filter-bar a.chip", { hasText: "Office" }).first().click();

    const url = new URL(page.url());
    expect(url.searchParams.get("cat")).toBe("Office");
    expect(url.searchParams.get("sort")).toBe("price-asc");
  });

  test("refine filters are preserved when switching categories", async ({ page }) => {
    await page.goto("/shop?cat=Everyday&fabric=Cotton");
    await page.locator(".filter-bar a.chip", { hasText: "All" }).first().click();

    const url = new URL(page.url());
    expect(url.searchParams.has("cat")).toBe(false);
    expect(url.searchParams.get("fabric")).toBe("Cotton");
  });

  test("direct URL with cat and sub renders correctly", async ({ page }) => {
    await page.goto("/shop?cat=Occasion&sub=festive-wear");

    // Correct products shown
    await expect(page.locator(".product-card .p-name", { hasText: "NavTest Occasion Lehenga" })).toBeVisible();
    // Correct chips highlighted
    await expect(page.locator(".filter-bar a.chip.active", { hasText: "Occasion" })).toBeVisible();
    await expect(page.locator(".filter-bar a.chip-sm.active", { hasText: "Festive Wear" })).toBeVisible();
    // Nav bar highlights Occasion
    await expect(page.locator("nav a.active", { hasText: "Occasion" })).toBeVisible();
  });
});
