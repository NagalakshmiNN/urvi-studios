// The financial workbook, downloaded.
//
// Admin only, and not because the numbers are secret from the two people who
// run the shop — because this one file is the whole trading history, the
// margins, the vendors and their GSTINs. It is the single most sensitive thing
// the site can produce.
//
// Dates come in as ?from=&to= so an accountant asking for a quarter gets a
// quarter. With neither, it is the current Indian financial year, which is what
// somebody pressing the button almost always means.

import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { buildFinancialReport, financialYearOf, type Period } from "@/lib/financial-report";
import { loadFinancialData } from "@/lib/financial-data";
import { buildFinancialWorkbook, financialWorkbookName } from "@/lib/financial-workbook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The period asked for, or the current financial year.
 *
 * A malformed date is refused rather than quietly ignored: silently reporting
 * the wrong twelve months is the one failure here that nobody would notice
 * until after it had been filed.
 */
export function resolvePeriod(
  from: string | null,
  to: string | null,
  now = new Date()
): { ok: true; period: Period } | { ok: false; error: string } {
  if (!from && !to) return { ok: true, period: financialYearOf(now) };
  if (!from || !to) return { ok: false, error: "Give both a start and an end date." };
  if (!DAY.test(from) || !DAY.test(to)) return { ok: false, error: "Dates must be written as YYYY-MM-DD." };
  if (from > to) return { ok: false, error: "The start date is after the end date." };
  return { ok: true, period: { from, to } };
}

export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const resolved = resolvePeriod(
    request.nextUrl.searchParams.get("from"),
    request.nextUrl.searchParams.get("to")
  );
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });

  const data = await loadFinancialData(resolved.period);
  const report = buildFinancialReport({ period: resolved.period, ...data });
  const workbook = buildFinancialWorkbook(report);

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${financialWorkbookName(report)}"`,
      // Never cached, anywhere. A shared cache holding the shop's whole
      // trading history would be the worst kind of leak.
      "Cache-Control": "private, no-store",
    },
  });
}
