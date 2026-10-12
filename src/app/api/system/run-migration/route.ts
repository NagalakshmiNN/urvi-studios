// Temporary endpoint to apply migration 0011 if it hasn't run.
// GET /api/system/run-migration?token=urvi-seed-2026-x7q9
// Delete this file after confirming migration applied.

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
    // First check if column already exists
    const colCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'is_test'
    `);

    if (colCheck.rows.length > 0) {
      return NextResponse.json({
        ok: true,
        message: "Column is_test already exists — no migration needed.",
        already_existed: true,
      });
    }

    // Apply migration 0011
    await db.execute(sql`
      ALTER TABLE "orders" ADD COLUMN "is_test" boolean NOT NULL DEFAULT false
    `);

    // Verify it worked
    const verify = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'is_test'
    `);

    return NextResponse.json({
      ok: true,
      message: "Migration 0011 applied successfully — is_test column added.",
      already_existed: false,
      verified: verify.rows.length > 0,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
