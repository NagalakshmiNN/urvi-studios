// Per-size stock — the real source of truth for "how many pieces of this
// product, in this size, are actually on hand." products.stock is kept as
// a synced total (sum of its sizes) so every existing read of it — badges,
// the low-stock list, sorting — stays accurate without having to touch
// each of those call sites individually.

import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";

// Order lines record a size *label* (e.g. "M"), never a size row id — a
// bulk Excel update-in-place replaces a product's size rows outright (see
// import-products), so a stored id would go stale the moment that happens.
// Matching by label at adjustment time is what stays correct across that.
export async function adjustStockForLine(productId: string, sizeLabel: string, qtyDelta: number) {
  const label = String(sizeLabel || "").trim();

  if (label) {
    const sizes = await db.query.productSizes.findMany({ where: eq(schema.productSizes.productId, productId) });
    const row = sizes.find((s) => s.label.toLowerCase() === label.toLowerCase());
    if (row) {
      await db
        .update(schema.productSizes)
        .set({ stock: sql`greatest(0, ${schema.productSizes.stock} + ${qtyDelta})` })
        .where(eq(schema.productSizes.id, row.id));
      await syncProductStockTotal(productId);
      return;
    }
  }

  // No matching size row — an unsized product, or the size was renamed or
  // removed since this order was placed. Fall back to the product's own
  // total so stock still moves somewhere sensible rather than being lost.
  await db
    .update(schema.products)
    .set({ stock: sql`greatest(0, ${schema.products.stock} + ${qtyDelta})` })
    .where(eq(schema.products.id, productId));
}

export async function syncProductStockTotal(productId: string) {
  await db
    .update(schema.products)
    .set({
      stock: sql`(select coalesce(sum(${schema.productSizes.stock}), 0) from ${schema.productSizes} where ${schema.productSizes.productId} = ${productId})`,
    })
    .where(eq(schema.products.id, productId));
}

// Splits a total as evenly as possible across `n` slots, front-loading the
// remainder — used wherever only one aggregate stock number is available
// (a fresh Excel import row) but per-size counts are needed. e.g.
// distributeStock(10, 3) -> [4, 3, 3].
export function distributeStock(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const remainder = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}
