// One-time production bootstrap endpoint: seeds starter categories/products,
// the admin login, and a starter coupon into a freshly-migrated database.
// Netlify's deploy pipeline only ever runs the SQL schema migration
// automatically — it never runs this seed data — so this route exists to
// let that happen with a single authenticated request instead of shell
// access to the production database.
//
// Protected by BOOTSTRAP_TOKEN (set as a Netlify env var). Every insert
// here is idempotent (checked against existing rows first, same as
// src/db/seed.ts), so calling this more than once is harmless — it just
// does nothing on the second call. Safe to leave in place, but the
// BOOTSTRAP_TOKEN env var can be deleted afterward to close it off.
//
// Note: Netlify's Next.js runtime snapshots environment variables at
// deploy time, not per-request — a change made via the dashboard/API only
// takes effect on the next deploy, which is why this comment exists (to
// force exactly that). (redeploy #2 — token re-verified correct on the
// Netlify side, this push just gets a fresh function build to read it.)

import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    const expected = process.env.BOOTSTRAP_TOKEN;

    if (!expected) {
      return NextResponse.json({ ok: false, error: "BOOTSTRAP_TOKEN is not configured." }, { status: 503 });
    }
    if (!token || token !== expected) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const { runSeed } = await import("@/db/seed");
    await runSeed();
    return NextResponse.json({ ok: true, message: "Seed complete." });
  } catch (err) {
    console.error("bootstrap route error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) },
      { status: 500 },
    );
  }
}
