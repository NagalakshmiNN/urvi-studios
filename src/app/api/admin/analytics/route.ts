// GET /api/admin/analytics?from=2026-01-01&to=2026-12-31
// Returns aggregated analytics data from the database for the admin dashboard.
// Protected by admin session cookie.

import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/db";
import { sql, and, gte, lte, eq, desc } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const adminId = await getAdminSession();
  if (!adminId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const from = request.nextUrl.searchParams.get("from") ?? "2020-01-01";
  const to = request.nextUrl.searchParams.get("to") ?? "2099-12-31";

  try {
    // ---- 1. Customer signups by day ----
    const signups = await db
      .select({
        day: sql<string>`date(${schema.customers.createdAt})`,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.customers)
      .where(and(
        gte(sql`date(${schema.customers.createdAt})`, from),
        lte(sql`date(${schema.customers.createdAt})`, to),
      ))
      .groupBy(sql`date(${schema.customers.createdAt})`)
      .orderBy(sql`date(${schema.customers.createdAt})`);

    // ---- 2. Auth attempts (logins) by day ----
    const logins = await db
      .select({
        day: sql<string>`date(${schema.authAttempts.createdAt})`,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.authAttempts)
      .where(and(
        gte(sql`date(${schema.authAttempts.createdAt})`, from),
        lte(sql`date(${schema.authAttempts.createdAt})`, to),
      ))
      .groupBy(sql`date(${schema.authAttempts.createdAt})`)
      .orderBy(sql`date(${schema.authAttempts.createdAt})`);

    // ---- 3. Orders by day ----
    const ordersByDay = await db
      .select({
        day: sql<string>`date(${schema.orders.createdAt})`,
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${schema.orders.total}), 0)::int`,
      })
      .from(schema.orders)
      .where(and(
        eq(schema.orders.isTest, false),
        gte(sql`date(${schema.orders.createdAt})`, from),
        lte(sql`date(${schema.orders.createdAt})`, to),
      ))
      .groupBy(sql`date(${schema.orders.createdAt})`)
      .orderBy(sql`date(${schema.orders.createdAt})`);

    // ---- 4. Payment status breakdown ----
    const paymentBreakdown = await db
      .select({
        status: schema.orders.paymentStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.orders)
      .where(and(
        eq(schema.orders.isTest, false),
        gte(sql`date(${schema.orders.createdAt})`, from),
        lte(sql`date(${schema.orders.createdAt})`, to),
      ))
      .groupBy(schema.orders.paymentStatus);

    // ---- 5. Payment method breakdown ----
    const paymentMethods = await db
      .select({
        method: schema.orders.paymentMethod,
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${schema.orders.total}), 0)::int`,
      })
      .from(schema.orders)
      .where(and(
        eq(schema.orders.isTest, false),
        sql`${schema.orders.paymentStatus} = 'PAID'`,
        gte(sql`date(${schema.orders.createdAt})`, from),
        lte(sql`date(${schema.orders.createdAt})`, to),
      ))
      .groupBy(schema.orders.paymentMethod);

    // ---- 6. Product views (top pages) ----
    const topPages = await db
      .select({
        productId: schema.productViews.productId,
        views: sql<number>`sum(${schema.productViews.viewCount})::int`,
      })
      .from(schema.productViews)
      .where(and(
        gte(schema.productViews.viewedOn, from),
        lte(schema.productViews.viewedOn, to),
      ))
      .groupBy(schema.productViews.productId)
      .orderBy(desc(sql`sum(${schema.productViews.viewCount})`))
      .limit(15);

    // Get product names for the top pages
    const productIds = topPages.map((p) => p.productId);
    let productNames: Record<string, string> = {};
    if (productIds.length > 0) {
      const products = await db
        .select({ id: schema.products.id, name: schema.products.name })
        .from(schema.products)
        .where(sql`${schema.products.id} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`);
      productNames = Object.fromEntries(products.map((p) => [p.id, p.name]));
    }

    // ---- 7. JS errors by day ----
    const errorsByDay = await db
      .select({
        day: sql<string>`date(${schema.analyticsEvents.createdAt})`,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.analyticsEvents)
      .where(and(
        sql`${schema.analyticsEvents.kind} IN ('js_error', 'unhandled_rejection')`,
        gte(sql`date(${schema.analyticsEvents.createdAt})`, from),
        lte(sql`date(${schema.analyticsEvents.createdAt})`, to),
      ))
      .groupBy(sql`date(${schema.analyticsEvents.createdAt})`)
      .orderBy(sql`date(${schema.analyticsEvents.createdAt})`);

    // ---- 8. Recent errors (latest 20) ----
    const recentErrors = await db
      .select({
        id: schema.analyticsEvents.id,
        kind: schema.analyticsEvents.kind,
        message: schema.analyticsEvents.message,
        pageUrl: schema.analyticsEvents.pageUrl,
        userAgent: schema.analyticsEvents.userAgent,
        createdAt: schema.analyticsEvents.createdAt,
      })
      .from(schema.analyticsEvents)
      .where(and(
        sql`${schema.analyticsEvents.kind} IN ('js_error', 'unhandled_rejection', 'api_error')`,
        gte(sql`date(${schema.analyticsEvents.createdAt})`, from),
        lte(sql`date(${schema.analyticsEvents.createdAt})`, to),
      ))
      .orderBy(desc(schema.analyticsEvents.createdAt))
      .limit(20);

    // ---- 9. Totals for the summary cards ----
    const [totals] = await db
      .select({
        totalCustomers: sql<number>`(SELECT count(*)::int FROM customers)`,
        totalOrders: sql<number>`(SELECT count(*)::int FROM orders WHERE is_test = false)`,
        totalRevenue: sql<number>`(SELECT coalesce(sum(total), 0)::int FROM orders WHERE is_test = false AND payment_status = 'PAID')`,
        totalErrors: sql<number>`(SELECT count(*)::int FROM analytics_events WHERE kind IN ('js_error', 'unhandled_rejection'))`,
      })
      .from(sql`(SELECT 1) AS dummy`);

    // Count signups and logins in the date range
    const signupCount = signups.reduce((s, r) => s + r.count, 0);
    const loginCount = logins.reduce((s, r) => s + r.count, 0);
    const orderCount = ordersByDay.reduce((s, r) => s + r.count, 0);
    const rangeRevenue = ordersByDay.reduce((s, r) => s + r.revenue, 0);
    const errorCount = errorsByDay.reduce((s, r) => s + r.count, 0);

    return NextResponse.json({
      ok: true,
      summary: {
        totalCustomers: totals.totalCustomers,
        totalOrders: totals.totalOrders,
        totalRevenue: totals.totalRevenue,
        totalErrors: totals.totalErrors,
        rangeSignups: signupCount,
        rangeLogins: loginCount,
        rangeOrders: orderCount,
        rangeRevenue,
        rangeErrors: errorCount,
      },
      signups,
      logins,
      ordersByDay,
      paymentBreakdown,
      paymentMethods,
      topPages: topPages.map((p) => ({
        productId: p.productId,
        name: productNames[p.productId] ?? p.productId,
        views: p.views,
      })),
      errorsByDay,
      recentErrors,
    });
  } catch (err) {
    console.error("admin/analytics GET error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
