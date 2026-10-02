// Records a product page view and returns today's approximate count.
//
// Called client-side on mount so bots and prefetches don't inflate the
// number. Uses UPSERT to keep exactly one row per product per day.

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const productId = body?.productId;
  if (!productId || typeof productId !== "string") {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  try {
    const result = await db.execute(sql`
      INSERT INTO product_views (product_id, viewed_on, view_count)
      VALUES (${productId}, CURRENT_DATE, 1)
      ON CONFLICT (product_id, viewed_on)
      DO UPDATE SET view_count = product_views.view_count + 1
      RETURNING view_count
    `);

    const count = result.rows?.[0]?.view_count ?? 1;
    return NextResponse.json({ views: count });
  } catch (err) {
    // Never let analytics break the page
    console.error("product view tracking error:", err);
    return NextResponse.json({ views: 0 });
  }
}
