// DISABLED — endpoint served its purpose. Remove this file on next cleanup.
// (Cannot delete from connected folder without delete permission.)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
export async function POST() { return NextResponse.json({ ok: false, error: "Removed." }, { status: 410 }); }
