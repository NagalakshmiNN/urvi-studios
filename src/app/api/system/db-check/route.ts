// Temporary diagnostic endpoint — delete after verifying migration status.
// GET /api/system/db-check?token=urvi-seed-2026-x7q9

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== "urvi-seed-2026-x7q9") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if is_test column exists on orders table
    const colCheck = await db.execute(sql`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'is_test'
    `);

    // Check drizzle migration journal
    let migrationRows: unknown[] = [];
    try {
      const migrationCheck = await db.execute(sql`
        SELECT * FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 5
      `);
      migrationRows = migrationCheck.rows;
    } catch {
      migrationRows = [{ error: "drizzle_migrations table not found" }];
    }

    // Quick count
    const orderCount = await db.execute(sql`SELECT count(*) as cnt FROM orders`);

    return NextResponse.json({
      is_test_column: colCheck.rows,
      column_exists: colCheck.rows.length > 0,
      recent_migrations: migrationRows,
      order_count: orderCount.rows[0],
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }, { status: 500 });
  }
}
