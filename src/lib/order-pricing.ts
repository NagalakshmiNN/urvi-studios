// Server-side source of truth for checkout totals. The client's cart (and
// its displayed prices) are only ever a convenience preview — every amount
// actually charged or persisted is recomputed here from the database, so a
// tampered client payload can never change what gets paid or stored.

import { db, schema } from "@/db";
import { eq, inArray, sql } from "drizzle-orm";
import { generateOrderNumberSeed } from "@/lib/format";

export const FREE_SHIP_THRESHOLD = 2999;
export const SHIP_COST = 149;

export type CartLineInput = { productId: string; size: string; color: string; qty: number };

export type PricedLine = {
  productId: string;
  productName: string;
  size: string;
  color: string;
  qty: number;
  price: number;
  image: string;
};

export type PricingResult =
  | { ok: true; lines: PricedLine[]; subtotal: number; shipping: number; discount: number; total: number; couponCode: string | null }
  | { ok: false; error: string };

export async function priceCart(items: CartLineInput[], couponCode?: string | null): Promise<PricingResult> {
  if (!items || items.length === 0) return { ok: false, error: "Your bag is empty." };
  if (items.length > 50) return { ok: false, error: "Too many items in one order." };

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await db.query.products.findMany({
    where: inArray(schema.products.id, productIds),
    with: { images: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: PricedLine[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product || !product.isActive) return { ok: false, error: "One of the items in your bag is no longer available." };
    const qty = Math.max(1, Math.min(10, Math.floor(item.qty) || 1));
    if (product.stock < qty) return { ok: false, error: `Only ${product.stock} left of "${product.name}" — please adjust the quantity.` };
    lines.push({
      productId: product.id,
      productName: product.name,
      size: String(item.size || "").slice(0, 20),
      color: String(item.color || "").slice(0, 40),
      qty,
      price: product.price,
      image: product.images[0]?.url ?? "",
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const shipping = subtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIP_COST;

  let discount = 0;
  let appliedCode: string | null = null;
  if (couponCode) {
    const coupon = await db.query.coupons.findFirst({ where: eq(schema.coupons.code, couponCode.trim().toUpperCase()) });
    if (coupon && coupon.active && subtotal >= coupon.minOrderValue && (!coupon.expiresAt || coupon.expiresAt > new Date())) {
      discount = coupon.type === "PERCENT" ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
      discount = Math.min(discount, subtotal);
      appliedCode = coupon.code;
    } else {
      return { ok: false, error: "That coupon code isn't valid for this order." };
    }
  }

  const total = subtotal + shipping - discount;
  return { ok: true, lines, subtotal, shipping, discount, total, couponCode: appliedCode };
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
