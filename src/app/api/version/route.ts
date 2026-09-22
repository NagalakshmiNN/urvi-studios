// Public on purpose: it reveals nothing but which release is live, and it has
// to be reachable without logging in for it to be useful when something looks
// wrong.

import { NextResponse } from "next/server";
import { BUILD_STAMP } from "@/lib/build-stamp";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ build: BUILD_STAMP }, { headers: { "Cache-Control": "no-store" } });
}
