// One-time: replace capital contributions with agreed totals.
// Lakshmi: ₹1,70,000 | Shilpa: ₹60,000
// Delete this file after running.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BOOTSTRAP_TOKEN = "urvi-seed-2026-x7q9";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== BOOTSTRAP_TOKEN)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Read current state
  const before = await db.query.capitalContributions.findMany();
  const beforeSummary = before.map(r => ({
    contributor: r.contributor,
    amount: r.amountPaise / 100,
    date: r.contributedOn,
  }));

  // 2. Delete all existing capital contributions
  await db.delete(schema.capitalContributions);

  // 3. Insert the two agreed totals (amounts in paise)
  const lakshmiPaise = 170000 * 100; // ₹1,70,000
  const shilpaPaise  =  60000 * 100; // ₹60,000

  await db.insert(schema.capitalContributions).values([
    {
      contributedOn: "2026-10-15",
      contributor: "Lakshmi",
      amountPaise: lakshmiPaise,
      mode: "bank",
      reference: "Agreed total investment",
      notes: "Total capital put in month-on-month for vendor purchases. Replaces individual entries.",
    },
    {
      contributedOn: "2026-10-15",
      contributor: "Shilpa",
      amountPaise: shilpaPaise,
      mode: "bank",
      reference: "Agreed total investment",
      notes: "Total capital put in for vendor purchases. Replaces individual entries.",
    },
  ]);

  // 4. Verify
  const after = await db.query.capitalContributions.findMany();
  const afterSummary = after.map(r => ({
    contributor: r.contributor,
    amount: r.amountPaise / 100,
    date: r.contributedOn,
  }));

  return NextResponse.json({
    ok: true,
    before: { count: before.length, rows: beforeSummary },
    after: { count: after.length, rows: afterSummary },
    totals: {
      lakshmi: "₹1,70,000",
      shilpa: "₹60,000",
      combined: "₹2,30,000",
    },
  });
}
