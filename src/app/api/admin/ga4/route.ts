// GET /api/admin/ga4?from=2026-10-01&to=2026-10-19
// Returns GA4 traffic data for the admin analytics dashboard.

import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { fetchGA4Data } from "@/lib/ga4";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const adminId = await getAdminSession();
  if (!adminId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const from = request.nextUrl.searchParams.get("from") ?? "30daysAgo";
  const to = request.nextUrl.searchParams.get("to") ?? "today";

  try {
    const data = await fetchGA4Data(from, to);
    return NextResponse.json(data);
  } catch (err) {
    console.error("admin/ga4 GET error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
