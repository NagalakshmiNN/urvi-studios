import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getConnectionString } from "@netlify/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BOOTSTRAP_TOKEN = "urvi-seed-2026-x7q9";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== BOOTSTRAP_TOKEN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sql = neon(getConnectionString());

  await sql`
    CREATE TABLE IF NOT EXISTS "review_media" (
      "id" text PRIMARY KEY NOT NULL,
      "review_id" text NOT NULL REFERENCES "reviews"("id") ON DELETE CASCADE,
      "kind" text NOT NULL,
      "asset_id" text NOT NULL REFERENCES "product_image_assets"("id"),
      "sort_order" integer NOT NULL DEFAULT 0,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;

  // Verify
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'review_media'
    ORDER BY ordinal_position
  `;
  const colNames = cols.map((c: Record<string, string>) => c.column_name);

  return NextResponse.json({
    ok: true,
    message: "review_media table created.",
    columns: colNames,
  });
}
