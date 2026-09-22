// Turning a page number and a page size from the address bar into a slice.
// Every value here arrives from a query string, which is to say from anyone.

import { test, expect } from "@playwright/test";
import { paginate, normalisePerPage, matchesSearch, DEFAULT_PAGE_SIZE } from "@/lib/table-paging";

test("no parameters means the first page of 25", () => {
  const p = paginate(214, undefined, undefined);
  expect(p.page).toBe(1);
  expect(p.perPage).toBe(DEFAULT_PAGE_SIZE);
  expect(p.start).toBe(0);
  expect(p.end).toBe(25);
  expect(p.from).toBe(1);
  expect(p.to).toBe(25);
  expect(p.totalPages).toBe(9);
});

test("the middle of the list counts from the right place", () => {
  const p = paginate(214, "3", "25");
  expect(p.start).toBe(50);
  expect(p.from).toBe(51);
  expect(p.to).toBe(75);
});

test("the last page is short, not padded", () => {
  const p = paginate(214, "9", "25");
  expect(p.start).toBe(200);
  expect(p.end).toBe(214);
  expect(p.to).toBe(214);
});

test("a page past the end lands on the last page", () => {
  // A bookmark to page 9 of a list that has since shrunk should show the last
  // page, not an empty table that looks like the products have gone.
  const p = paginate(30, "99", "25");
  expect(p.page).toBe(2);
  expect(p.from).toBe(26);
  expect(p.to).toBe(30);
});

test("nonsense page numbers fall back to the first page", () => {
  for (const bad of ["0", "-4", "abc", "", "NaN", "2.7e9"]) {
    expect(paginate(100, bad, "25").page).toBeGreaterThanOrEqual(1);
  }
  expect(paginate(100, "abc", "25").page).toBe(1);
  expect(paginate(100, "-4", "25").page).toBe(1);
});

test("only the offered page sizes are honoured", () => {
  expect(normalisePerPage("50")).toBe(50);
  expect(normalisePerPage("100")).toBe(100);
  // Asking for everything is how a listing page becomes a way to make the
  // server do a lot of work on request.
  expect(normalisePerPage("99999999")).toBe(DEFAULT_PAGE_SIZE);
  expect(normalisePerPage("7")).toBe(DEFAULT_PAGE_SIZE);
  expect(normalisePerPage(undefined)).toBe(DEFAULT_PAGE_SIZE);
});

test("an empty list reports zero rather than a phantom first row", () => {
  const p = paginate(0, "1", "25");
  expect(p.from).toBe(0);
  expect(p.to).toBe(0);
  expect(p.totalPages).toBe(1);
});

const item = (name: string, sku: string | null, category?: string) => ({
  name,
  sku,
  category: category ? { name: category } : null,
});

test("search looks at name, product ID and category", () => {
  const p = item("Blush Bloom – 3PC Designer Set", "URVI-BLUSH-1470-2", "Festive Wear");
  expect(matchesSearch(p, "blush")).toBe(true);
  expect(matchesSearch(p, "1470")).toBe(true);
  expect(matchesSearch(p, "festive")).toBe(true);
  expect(matchesSearch(p, "mustard")).toBe(false);
});

test("case and stray spaces don't matter", () => {
  // A product ID copied from a spreadsheet usually arrives with a space.
  const p = item("Olive Grace", "URVI-OLIVE-1461-1", "Festive Wear");
  expect(matchesSearch(p, "  URVI-olive  ")).toBe(true);
  expect(matchesSearch(p, "OLIVE")).toBe(true);
});

test("an empty search matches everything", () => {
  const p = item("Anything", "SKU-1");
  expect(matchesSearch(p, "")).toBe(true);
  expect(matchesSearch(p, "   ")).toBe(true);
});

test("a product with no SKU or category is still searchable by name", () => {
  const p = item("Straight Regular Kurthas", null);
  expect(matchesSearch(p, "kurthas")).toBe(true);
  expect(matchesSearch(p, "nothing")).toBe(false);
});
