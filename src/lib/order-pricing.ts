// Server-side source of truth for checkout totals. The client's cart (and
// its displayed prices) are only ever a convenience preview — every amount
// actually charged or persisted is recomputed here from the database, so a
// tampered client payload can never change what gets paid or stored.

import { db, schema } from "@/db";
import { eq, inArray, sql } from "drizzle-orm";
import { generateOrderNumberSeed } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";
import { countCouponUses, withinLimits } from "@/lib/coupon-usage";

// Re-exported so existing importers (shipping-returns page, order detail
// pages) don't need to change — src/lib/shipping.ts is the actual source of
// truth, kept client-safe (no db import) so cart/checkout can use it too.
export const FREE_SHIP_THRESHOLD = FREE_SHIPPING_THRESHOLD;

export type CartLineInput = {
  productId: string;
  size: string;
  color: string;
  qty: number;
  /**
   * What the admin actually charged for one piece, in whole rupees.
   *
   * IGNORED unless the caller explicitly passes `allowPriceOverride`. The
   * storefront never passes it, so a tampered cart payload still cannot set
   * its own prices — that guarantee is the whole point of this module.
   */
  unitPriceOverride?: number;
};

/** The most that can be charged for a single piece — a guard against a slipped
 *  keystroke turning ₹1,940 into ₹19,40,000, not a limit on the business. */
export const MAX_UNIT_PRICE = 1_000_000;

/**
 * Validate a hand-entered unit price. Whole rupees only, because every other
 * amount on an order is stored as an integer number of rupees; accepting
 * decimals here would mean silently rounding them away.
 */
export function parseUnitPriceOverride(raw: string | null | undefined): { ok: true; price: number } | { ok: false; error: string } {
  const value = (raw ?? "").trim();
  if (value === "") return { ok: false, error: "Enter a price for every item." };
  if (!/^\d+$/.test(value)) {
    return { ok: false, error: `"${value}" isn't a price — use whole rupees, digits only.` };
  }
  const price = Number(value);
  if (price <= 0) return { ok: false, error: "A price has to be more than zero." };
  if (price > MAX_UNIT_PRICE) {
    return { ok: false, error: `That price looks like a slip — the most you can enter per piece is ₹${MAX_UNIT_PRICE.toLocaleString("en-IN")}.` };
  }
  return { ok: true, price };
}

export type PricedLine = {
  productId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  qty: number;
  price: number;
  // What this piece cost us on the day it sold. Copied onto the order line so
  // a later invoice changing the product's landed cost cannot rewrite the
  // margin on a sale that already happened.
  landedCost: number | null;
  image: string;
};

export type PricingResult =
  // `shipping` is never charged upfront — actual courier cost depends on
  // pincode, distance, and package weight, none of which we calculate at
  // checkout. Orders above FREE_SHIP_THRESHOLD are genuinely free; orders
  // below it ship with `freeShipping: false`, meaning the team confirms the
  // real charge with the customer separately before dispatch (see the
  // Shipping & Delivery page). Never reintroduce a flat shipping fee here —
  // that was the exact thing removed.
  | { ok: true; lines: PricedLine[]; subtotal: number; shipping: number; freeShipping: boolean; discount: number; total: number; couponCode: string | null }
  | { ok: false; error: string };

export async function priceCart(
  items: CartLineInput[],
  couponCode?: string | null,
  // Admin-only. Set by the Record a Sale form, where the person entering the
  // order is a signed-in admin deciding what was actually charged, and never
  // by anything reachable from the storefront.
  opts?: {
    allowPriceOverride?: boolean;
    /**
     * Who is buying, for the per-customer coupon limit.
     *
     * Optional because the coupon preview on the cart page runs before anyone
     * has typed an email address. The total limit is still enforced there;
     * only the per-customer one needs a name to check against, and it is
     * checked again at checkout where the email is known.
     */
    customerEmail?: string | null;
  }
): Promise<PricingResult> {
  if (!items || items.length === 0) return { ok: false, error: "Your bag is empty." };
  if (items.length > 50) return { ok: false, error: "Too many items in one order." };

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await db.query.products.findMany({
    where: inArray(schema.products.id, productIds),
    with: { images: true, sizes: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  // Lines are combined by product and size before anything is checked.
  //
  // Each line used to be validated on its own, and the only ceilings were 50
  // lines and 10 per line — so the same shoe, sent fifty times at ten each,
  // passed fifty individual "is there enough?" checks and became an order for
  // five hundred against a stock of ten. The customer pays for all of them.
  // What matters is the total wanted of one thing, so that is what is counted.
  const wanted = new Map<string, { item: CartLineInput; qty: number }>();
  for (const item of items) {
    const qty = Math.max(1, Math.min(10, Math.floor(item.qty) || 1));
    const key = `${item.productId}::${String(item.size || "").trim().toLowerCase()}::${String(item.color || "").trim().toLowerCase()}`;
    const existing = wanted.get(key);
    if (existing) existing.qty = Math.min(10, existing.qty + qty);
    else wanted.set(key, { item, qty });
  }

  const lines: PricedLine[] = [];
  for (const { item, qty } of wanted.values()) {
    const product = byId.get(item.productId);
    if (!product || !product.isActive) return { ok: false, error: "One of the items in your bag is no longer available." };

    // A size that matches no row used to fall back to the product's total —
    // the sum across every size — so asking for a sold-out "S" as "Small"
    // was checked against the stock of every other size and sailed through.
    // Worse, the later deduction also found no row and wrote the product
    // total, which the next real sale recomputed and silently discarded.
    //
    // An unsized product (no size rows at all) is still legitimate and still
    // uses the product total. A named size that does not exist is not.
    const sizeLabel = String(item.size || "").trim();
    const matchedSize = product.sizes.find((s) => s.label.toLowerCase() === sizeLabel.toLowerCase());
    if (!matchedSize && product.sizes.length > 0) {
      return { ok: false, error: `That size is no longer available for "${product.name}" — please choose another.` };
    }

    const available = matchedSize ? matchedSize.stock : product.stock;
    if (available < qty) {
      const sizeNote = matchedSize ? ` in size ${matchedSize.label}` : "";
      return { ok: false, error: `Only ${available} left${sizeNote} of "${product.name}" — please adjust the quantity.` };
    }

    lines.push({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      size: String(item.size || "").slice(0, 20),
      color: String(item.color || "").slice(0, 40),
      qty,
      // The catalogue price unless an admin has said otherwise — a piece sold
      // at the door for less (or as part of a deal) should record what was
      // actually paid, because revenue, profit and the customer's own history
      // all read from this number.
      price:
        opts?.allowPriceOverride &&
        typeof item.unitPriceOverride === "number" &&
        Number.isInteger(item.unitPriceOverride) &&
        item.unitPriceOverride > 0 &&
        item.unitPriceOverride <= MAX_UNIT_PRICE
          ? item.unitPriceOverride
          : product.price,
      landedCost: product.landedCost ?? null,
      image: product.images[0]?.url ?? "",
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const freeShipping = subtotal >= FREE_SHIP_THRESHOLD;
  // Not charged at checkout either way — see the PricingResult comment above.
  const shipping = 0;

  let discount = 0;
  let appliedCode: string | null = null;
  if (couponCode) {
    const coupon = await db.query.coupons.findFirst({ where: eq(schema.coupons.code, couponCode.trim().toUpperCase()) });
    if (!coupon || !coupon.active || subtotal < coupon.minOrderValue || (coupon.expiresAt && coupon.expiresAt <= new Date())) {
      return { ok: false, error: "That coupon code isn't valid for this order." };
    }

    // How many times it has been used, and by whom.
    //
    // A code with no ceiling is a standing offer to anyone who finds it, and
    // codes do get found — screenshotted off an Instagram post, forwarded
    // into a deals group, pasted onto a coupon site. The limits are checked
    // here rather than only in the preview route, because the preview is a
    // convenience and this is the function that decides what is actually
    // charged.
    //
    // Two checkouts landing in the same second can both see the last
    // remaining use and both take it. That is a real race and it is left
    // alone: the cost is one extra discount on a code that was about to run
    // out, and closing it properly means locking the coupon row on every
    // checkout for a shop that takes a handful of orders a day.
    const counts = await countCouponUses(coupon.code, opts?.customerEmail ?? null);
    const verdict = withinLimits(
      { usageLimit: coupon.usageLimit, perCustomerLimit: coupon.perCustomerLimit },
      counts
    );
    if (!verdict.ok) return { ok: false, error: verdict.error };

    discount = coupon.type === "PERCENT" ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
    discount = Math.min(discount, subtotal);
    appliedCode = coupon.code;
  }

  const total = subtotal + shipping - discount;
  return { ok: true, lines, subtotal, shipping, freeShipping, discount, total, couponCode: appliedCode };
}

export async function nextOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `orders_${year}`;
  // Atomic increment-and-read in one round trip, so two checkouts landing
  // at the same instant can never be handed the same order number.
  const result = await db.execute<{ value: number }>(sql`
    INSERT INTO ${schema.counters} (key, value) VALUES (${key}, 1)
    ON CONFLICT (key) DO UPDATE SET value = ${schema.counters.value} + 1
    RETURNING value
  `);
  const seq = result.rows[0]?.value ?? 1;
  return generateOrderNumberSeed(year, seq);
}
