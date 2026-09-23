// One row per piece, one column per size, a count in each cell.

import { test, expect } from "@playwright/test";
import { buildStockGrid, sizeColumn, cellTone, visibleColumns, SIZE_COLUMNS } from "@/lib/stock-grid";

const product = (over: Partial<Parameters<typeof buildStockGrid>[0][number]> = {}) => ({
  id: "p1",
  sku: "URVI-TEST-0001",
  name: "Test Piece",
  slug: "test-piece",
  isActive: true,
  images: [{ url: "/api/images/abc", position: 0 }],
  sizes: [{ label: "M", stock: 3 }],
  ...over,
});

test("columns run smallest to largest, not alphabetically", () => {
  // Sorting these as text puts XXL before XS and 3XL before S. Size order is
  // knowledge about clothes, not about strings.
  expect(SIZE_COLUMNS.indexOf("XS")).toBeLessThan(SIZE_COLUMNS.indexOf("S"));
  expect(SIZE_COLUMNS.indexOf("XL")).toBeLessThan(SIZE_COLUMNS.indexOf("XXL"));
  expect(SIZE_COLUMNS.indexOf("XXL")).toBeLessThan(SIZE_COLUMNS.indexOf("3XL"));
  expect(SIZE_COLUMNS.indexOf("3XL")).toBeLessThan(SIZE_COLUMNS.indexOf("7XL"));
});

test("the same size written differently lands in one column", () => {
  expect(sizeColumn("2XL")).toBe("XXL");
  expect(sizeColumn("XXXL")).toBe("3XL");
  expect(sizeColumn(" m ")).toBe("M");
  expect(sizeColumn("Large")).toBe("L");
  expect(sizeColumn("x-s")).toBe("XS");
});

test("a size we don't have a column for is not forced into one", () => {
  // Putting "Free Size" or "28" in the nearest column would send someone to
  // a shelf for a garment that isn't on it.
  expect(sizeColumn("Free Size")).toBeNull();
  expect(sizeColumn("28")).toBeNull();
  expect(sizeColumn("")).toBeNull();
});

test("a product's stock lands in the right cells", () => {
  const grid = buildStockGrid([
    product({ sizes: [{ label: "S", stock: 2 }, { label: "M", stock: 5 }, { label: "XL", stock: 0 }] }),
  ]);
  expect(grid.rows[0].cells.S).toBe(2);
  expect(grid.rows[0].cells.M).toBe(5);
  expect(grid.rows[0].cells.XL).toBe(0);
  expect(grid.rows[0].total).toBe(7);
});

test("a size the product doesn't come in is blank, not zero", () => {
  // "We don't make it" and "we've run out" are different facts, and only one
  // of them is worth reordering.
  const grid = buildStockGrid([product({ sizes: [{ label: "M", stock: 4 }] })]);
  expect(grid.rows[0].cells.M).toBe(4);
  expect(grid.rows[0].cells.XS).toBeNull();
  expect(grid.rows[0].cells["7XL"]).toBeNull();
});

test("two labels for one size are added, not overwritten", () => {
  // A product listing both XXL and 2XL has two rows for one shelf.
  const grid = buildStockGrid([
    product({ sizes: [{ label: "XXL", stock: 2 }, { label: "2XL", stock: 3 }] }),
  ]);
  expect(grid.rows[0].cells.XXL).toBe(5);
});

test("unrecognised sizes are kept aside and still counted in the total", () => {
  const grid = buildStockGrid([
    product({ sizes: [{ label: "M", stock: 2 }, { label: "Free Size", stock: 4 }] }),
  ]);
  expect(grid.rows[0].other).toEqual([{ label: "Free Size", stock: 4 }]);
  expect(grid.rows[0].total).toBe(6);
});

test("column and grand totals add up across products", () => {
  const grid = buildStockGrid([
    product({ id: "a", sizes: [{ label: "M", stock: 2 }] }),
    product({ id: "b", sizes: [{ label: "M", stock: 3 }, { label: "L", stock: 1 }] }),
  ]);
  expect(grid.columnTotals.M).toBe(5);
  expect(grid.columnTotals.L).toBe(1);
  expect(grid.grandTotal).toBe(6);
});

test("columns nothing uses are reported so the table can drop them", () => {
  const grid = buildStockGrid([product({ sizes: [{ label: "M", stock: 1 }] })]);
  expect(grid.emptyColumns).toContain("7XL");
  expect(grid.emptyColumns).not.toContain("M");
  expect(visibleColumns(grid)).toEqual(["M"]);
});

test("the thumbnail is the first image by position, not by array order", () => {
  const grid = buildStockGrid([
    product({ images: [{ url: "/second", position: 2 }, { url: "/first", position: 0 }] }),
  ]);
  expect(grid.rows[0].imageUrl).toBe("/first");
});

test("a product with no photographs still gets a row", () => {
  const grid = buildStockGrid([product({ images: [] })]);
  expect(grid.rows[0].imageUrl).toBeNull();
  expect(grid.rows).toHaveLength(1);
});

test("negative stock reads as out, not as something in hand", () => {
  // Stock can go negative when an order oversells; the grid must not show
  // that as anything other than empty.
  expect(cellTone(null)).toBe("none");
  expect(cellTone(-2)).toBe("out");
  expect(cellTone(0)).toBe("out");
  expect(cellTone(1)).toBe("low");
  expect(cellTone(2)).toBe("low");
  expect(cellTone(3)).toBe("ok");
});

test("an empty catalogue produces an empty grid rather than throwing", () => {
  const grid = buildStockGrid([]);
  expect(grid.rows).toEqual([]);
  expect(grid.grandTotal).toBe(0);
  expect(visibleColumns(grid)).toEqual([]);
});
