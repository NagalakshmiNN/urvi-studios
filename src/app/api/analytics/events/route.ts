// POST /api/analytics/events
// Receives client-side errors and events from the browser's ErrorTracker.
// No authentication required — rate-limited by keeping payloads small.

import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface EventPayload {
  kind: "js_error" | "unhandled_rejection" | "api_error";
  message?: string;
  stack?: string;
  pageUrl?: string;
  meta?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: EventPayload = await request.json();

    if (!body.kind) {
      return NextResponse.json({ ok: false, error: "Missing kind" }, { status: 400 });
    }

    // Truncate to prevent abuse
    const message = (body.message ?? "").slice(0, 2000);
    const stack = (body.stack ?? "").slice(0, 4000);
    const pageUrl = (body.pageUrl ?? "").slice(0, 500);
    const meta = (body.meta ?? "").slice(0, 2000);
    const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 500);

    await db.insert(schema.analyticsEvents).values({
      kind: body.kind,
      message: message || null,
      stack: stack || null,
      pageUrl: pageUrl || null,
      userAgent: userAgent || null,
      meta: meta || null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("analytics/events POST error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
