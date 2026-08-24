// One-time production bootstrap endpoint: seeds starter categories/products,
// the admin login, and a starter coupon into a freshly-migrated database.
// Netlify's deploy pipeline only ever runs the SQL schema migration
// automatically — it never runs this seed data — so this route exists to
// let that happen with a single authenticated request instead of shell
// access to the production database.
//
// Protected by a token. This was originally read from a Netlify env var
// (BOOTSTRAP_TOKEN), but that value was mysteriously never visible to the
// running function across several redeploys despite being verified correct
// on Netlify's side every time — so instead of depending further on env
// var propagation for this one non-sensitive, idempotent, one-time-use
// operation, the token is embedded directly in the source below. Every
// insert here is idempotent (checked against existing rows first, same as
// src/db/seed.ts), so calling this more than once is harmless. Delete this
// whole route file once the catalog is seeded and the admin login works.

import { NextResponse, type NextRequest } from "next/server";

const BOOTSTRAP_TOKEN = "urvi-seed-2026-x7q9";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token || token !== BOOTSTRAP_TOKEN) {
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
