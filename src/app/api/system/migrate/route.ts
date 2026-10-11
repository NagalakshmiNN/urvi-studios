/**
 * One-time migration endpoint — runs pending schema migrations (0005–0010)
 * that Netlify's auto-migration may have missed.
 *
 * Protected by the same bootstrap token. Idempotent — safe to call more
 * than once (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS).
 *
 * DELETE THIS FILE once the tables are confirmed present.
 */
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

const TOKEN = "urvi-seed-2026-x7q9";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIGRATIONS = [
  // 0005 — parent_tags on products
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "parent_tags" text`,

  // 0006 — fabric_tags on products
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "fabric_tags" text`,

  // 0007 — sale_by + actual_sale_price_paise on orders
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "sale_by" text`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "actual_sale_price_paise" integer`,
  `UPDATE "orders" SET "sale_by" = 'Website' WHERE "source" = 'online' AND "sale_by" IS NULL`,

  // 0008 — site_settings
  `CREATE TABLE IF NOT EXISTS "site_settings" (
    "key" text PRIMARY KEY NOT NULL,
    "value" text NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `INSERT INTO "site_settings" ("key", "value")
   VALUES ('beta_banner_enabled', 'false') ON CONFLICT DO NOTHING`,

  // 0009 — shadowfax tracking columns on orders
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "awb_number" text`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shadowfax_order_id" text`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courier_status" text`,

  // 0010 — warehouses
  `CREATE TABLE IF NOT EXISTS "warehouses" (
    "id" text PRIMARY KEY NOT NULL,
    "label" text NOT NULL,
    "contact_name" text NOT NULL,
    "contact_phone" text NOT NULL,
    "address_line1" text NOT NULL,
    "address_line2" text DEFAULT '',
    "city" text NOT NULL,
    "state" text NOT NULL,
    "pincode" text NOT NULL,
    "is_default" boolean NOT NULL DEFAULT false,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,

  // 0011 — checkout_sessions (pay-first flow)
  `CREATE TABLE IF NOT EXISTS "checkout_sessions" (
    "id" text PRIMARY KEY NOT NULL,
    "order_number" text NOT NULL UNIQUE,
    "razorpay_order_id" text NOT NULL,
    "customer_id" text REFERENCES "customers"("id"),
    "payload" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
];

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token || token !== TOKEN) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const results: string[] = [];
    for (const stmt of MIGRATIONS) {
      await db.execute(sql.raw(stmt));
      results.push(stmt.slice(0, 60).replace(/\s+/g, " ") + "…");
    }

    return NextResponse.json({ ok: true, applied: results.length, statements: results });
  } catch (err) {
    console.error("migrate route error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) },
      { status: 500 },
    );
  }
}
