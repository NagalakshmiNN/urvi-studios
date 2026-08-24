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

import { NextResponse } from "next/server";
import { runSeed } from "@/db/seed";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const expected = process.env.BOOTSTRAP_TOKEN;

  if (!expected) {
    return NextResponse.json({ ok: false, error: "BOOTSTRAP_TOKEN is not configured." }, { status: 503 });
  }
  if (!token || token !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    await runSeed();
    return NextResponse.json({ ok: true, message: "Seed complete." });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
