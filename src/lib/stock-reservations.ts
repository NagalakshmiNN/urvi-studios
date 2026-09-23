// Garments that are spoken for but still on the shelf.
//
// A WhatsApp/COD order is a request, not a sale. Nobody has paid, and until
// somebody confirms it the garment is still there to be sold to the next
// person who walks in. So the stock count does not move — which is correct,
// and which is also exactly how the same garment gets promised twice.
//
// The question asked was whether an order arriving should reduce the stock.
// Both answers are wrong in a way: deducting makes the grid say zero for a
// kurti that is hanging on the rail, and an order nobody ever chases holds it
// there forever; not deducting makes the grid say one for a kurti that is
// already someone's. The third answer is to show both numbers, which is the
// only one that is never a lie: the count is what is on the shelf, and beside
// it, how many of those are already promised.
//
// Nothing here changes a stock number. It only reports what is pending.

import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";

/** productId → size label (lower case) → how many are spoken for. */
export type Reservations = Map<string, Map<string, number>>;

/**
 * Lines on orders that are waiting on somebody.
 *
 * Narrow on purpose. Only a WhatsApp/COD order counts: it is the one path
 * where a real person has asked for a real garment and the shop has not yet
 * taken it off the shelf. An abandoned Razorpay checkout looks identical in
 * the database — placed, unpaid, stock not deducted — but nobody is waiting
 * on the other end of it, and counting those would fill the grid with holds
 * that mean nothing.
 */
export async function pendingReservations(): Promise<Reservations> {
  const rows = await db
    .select({
      productId: schema.orderItems.productId,
      size: schema.orderItems.size,
      qty: schema.orderItems.qty,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(
      and(
        eq(schema.orders.paymentMethod, "whatsapp_cod"),
        eq(schema.orders.stockDeducted, false),
        ne(schema.orders.status, "CANCELLED"),
        ne(schema.orders.status, "RETURNED")
      )
    );

  const byProduct: Reservations = new Map();
  for (const row of rows) {
    if (!row.productId) continue;
    const label = String(row.size || "").trim().toLowerCase();
    const sizes = byProduct.get(row.productId) ?? new Map<string, number>();
    sizes.set(label, (sizes.get(label) ?? 0) + row.qty);
    byProduct.set(row.productId, sizes);
  }
  return byProduct;
}

/** The held counts for one product, in the shape buildStockGrid wants. */
export function heldForProduct(
  reservations: Reservations,
  productId: string
): { label: string; qty: number }[] {
  const sizes = reservations.get(productId);
  if (!sizes) return [];
  return [...sizes.entries()].map(([label, qty]) => ({ label, qty }));
}
