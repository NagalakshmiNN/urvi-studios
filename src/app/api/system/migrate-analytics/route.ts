// One-time migration endpoint: creates the analytics_events table.
// DELETE THIS FILE after migration is confirmed.
//
// Usage: GET /api/system/migrate-analytics?token=urvi-seed-2026-x7q9

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

const BOOTSTRAP_TOKEN = "urvi-seed-2026-x7q9";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token !== BOOTSTRAP_TOKEN) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "analytics_events" (
        "id" text PRIMARY KEY NOT NULL,
        "kind" text NOT NULL,
        "page_url" text,
        "message" text,
        "stack" text,
        "user_agent" text,
        "customer_id" text,
        "meta" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    // Verify
    const check = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'analytics_events'
      ORDER BY ordinal_position
    `);

    return NextResponse.json({
      ok: true,
      message: "analytics_events table created.",
      columns: check.rows.map((r: any) => r.column_name),
    });
  } catch (err) {
    console.error("migrate-analytics error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
