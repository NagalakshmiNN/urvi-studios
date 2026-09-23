// One row per piece, one column per size, a count in each cell.

import { test, expect } from "@playwright/test";
import { buildStockGrid, sizeColumn, cellTone, freeToSell, visibleColumns, SIZE_COLUMNS } from "@/lib/stock-grid";

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

// ------------------------------- Garments promised but still on the shelf
//
// A WhatsApp order is a request, not a sale: nobody has paid and the stock
// has not moved. Deducting it would say a kurti isn't there while it hangs
// on the rail; ignoring it is how the same kurti gets promised twice. Both
// numbers are carried, and neither is subtracted from the other.

test("a hold is counted beside the stock, never taken out of it", () => {
  const grid = buildStockGrid([
    product({ sizes: [{ label: "M", stock: 3 }], held: [{ label: "M", qty: 1 }] }),
  ]);
  // The shelf still holds three. One of them is spoken for.
  expect(grid.rows[0].cells.M).toBe(3);
  expect(grid.rows[0].heldCells.M).toBe(1);
  expect(grid.rows[0].total).toBe(3);
  expect(grid.rows[0].heldTotal).toBe(1);
  expect(grid.grandTotal).toBe(3);
  expect(grid.heldGrandTotal).toBe(1);
});

test("a hold written as 2XL lands in the XXL column with the stock it holds", () => {
  // Order lines record whatever label was on the product the day it sold, so
  // a hold and its stock can be spelt differently and still be one shelf.
  const grid = buildStockGrid([
    product({ sizes: [{ label: "XXL", stock: 2 }], held: [{ label: "2XL", qty: 2 }] }),
  ]);
  expect(grid.rows[0].heldCells.XXL).toBe(2);
});

test("every piece in a cell being promised reads differently from being gone", () => {
  // One in stock and one promised is not a piece you can sell — but it is
  // also not an empty shelf, and telling a customer it's out of stock when
  // it's hanging there is its own mistake.
  expect(cellTone(1, 2, 1)).toBe("held");
  expect(cellTone(3, 2, 3)).toBe("held");
  // Still one spare: low, not held.
  expect(cellTone(3, 2, 2)).toBe("low");
  // A hold cannot make an empty shelf read as anything but empty.
  expect(cellTone(0, 2, 1)).toBe("out");
  // No holds at all leaves every existing reading exactly as it was.
  expect(cellTone(3, 2, 0)).toBe("ok");
});

test("what's free to sell is the count less the holds, and never negative", () => {
  expect(freeToSell(5, 2)).toBe(3);
  expect(freeToSell(1, 1)).toBe(0);
  // More promised than held happens when stock is adjusted down after an
  // order was taken; it means nothing is available, not that we owe minus one.
  expect(freeToSell(1, 4)).toBe(0);
  expect(freeToSell(null, 0)).toBe(0);
});

test("a product with no holds behaves exactly as before", () => {
  const grid = buildStockGrid([product({ sizes: [{ label: "M", stock: 4 }] })]);
  expect(grid.rows[0].heldTotal).toBe(0);
  expect(grid.rows[0].heldCells.M).toBe(0);
  expect(grid.heldGrandTotal).toBe(0);
});
