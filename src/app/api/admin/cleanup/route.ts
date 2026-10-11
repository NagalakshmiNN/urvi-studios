// One-time cleanup endpoint: marks test orders and deactivates test products.
//
// Protected by admin session. Idempotent — safe to call more than once.
// Delete this file once the cleanup has been run on production.

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, or, lte, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const results: string[] = [];

  // 1. Mark test orders — orders with total <= ₹100 that are test purchases.
  //    These are the ₹10 and ₹21 test orders that skew Money Map and Reports.
  //    We identify them by low total value (≤ ₹100).
  const testOrderResult = await db
    .update(schema.orders)
    .set({ isTest: true })
    .where(and(lte(schema.orders.total, 100), eq(schema.orders.isTest, false)))
    .returning({ orderNumber: schema.orders.orderNumber, total: schema.orders.total });

  results.push(`Marked ${testOrderResult.length} test orders: ${testOrderResult.map((o) => `${o.orderNumber} (₹${o.total})`).join(", ") || "none"}`);

  // 2. Deactivate test products — products with price ≤ ₹100.
  const testProductResult = await db
    .update(schema.products)
    .set({ isActive: false })
    .where(and(lte(schema.products.price, 100), eq(schema.products.isActive, true)))
    .returning({ name: schema.products.name, price: schema.products.price, sku: schema.products.sku });

  results.push(`Deactivated ${testProductResult.length} test products: ${testProductResult.map((p) => `${p.name} (₹${p.price}, ${p.sku})`).join(", ") || "none"}`);

  // 3. Summary: how many test vs real orders remain
  const [{ testCount } = { testCount: 0 }] = await db
    .select({ testCount: sql<number>`count(*)` })
    .from(schema.orders)
    .where(eq(schema.orders.isTest, true));

  const [{ realCount } = { realCount: 0 }] = await db
    .select({ realCount: sql<number>`count(*)` })
    .from(schema.orders)
    .where(eq(schema.orders.isTest, false));

  results.push(`Orders now: ${realCount} real, ${testCount} test`);

  return NextResponse.json({ ok: true, results });
}
