// Temporary endpoint to run migration 0015 (mascot system).
// Delete this file after the migration has been applied.
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
    // 1. Create mascot_messages table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "mascot_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "message" text NOT NULL,
        "animation" text DEFAULT 'wave' NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    // 2. Seed mascot settings
    await db.execute(sql`
      INSERT INTO "site_settings" ("key", "value") VALUES
        ('mascot_enabled', 'true'),
        ('mascot_image_a', '/mascots/mascot-ivory.png'),
        ('mascot_image_b', '/mascots/mascot-mustard.png')
      ON CONFLICT DO NOTHING
    `);

    // 3. Seed default messages (only if table is empty)
    const existing = await db.execute(sql`SELECT count(*) as cnt FROM mascot_messages`);
    const count = Number((existing as any).rows?.[0]?.cnt ?? (existing as any)[0]?.cnt ?? 0);

    if (count === 0) {
      await db.execute(sql`
        INSERT INTO "mascot_messages" ("message", "animation", "sort_order") VALUES
          ('Namaste! 🙏', 'namaste', 1),
          ('Hi!', 'wave', 2),
          ('Hey there!', 'wave', 3),
          ('How are you doing today?', 'wave', 4),
          ('Having a good day?', 'namaste', 5),
          ('I''m thinking of seeing new arrivals!', 'jump', 6),
          ('Have you seen the new arrivals?', 'twirl', 7),
          ('I want something to wear to office!', 'dance', 8),
          ('I want something light to wear...', 'sit', 9),
          ('Something breezy for today?', 'twirl', 10),
          ('I heard there is some offer going on!', 'jump', 11),
          ('Yes it''s true! Check it out!', 'dance', 12),
          ('Psst… there''s a sale!', 'jump', 13),
          ('How about movie night today?', 'dance', 14),
          ('What are your plans tonight?', 'sit', 15),
          ('Feeling fabulous today!', 'twirl', 16),
          ('Ooosh!', 'jump', 17),
          ('Welcome to URVI Studios!', 'namaste', 18)
      `);
    }

    return NextResponse.json({
      ok: true,
      message: "Migration 0015 applied: mascot_messages table created, settings seeded, " + (count === 0 ? "18 default messages inserted." : "messages already existed, skipped."),
    });
  } catch (err) {
    console.error("Migration 0015 error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) },
      { status: 500 },
    );
  }
}
