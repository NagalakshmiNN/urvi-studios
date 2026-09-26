// The daily stock email.
//
// Called by a schedule rather than by a person, so it cannot use the admin
// session: there is no browser and no cookie. It is protected by a shared
// secret in a header instead — REPORT_TOKEN, set in the hosting environment
// alongside the other secrets and never in this repository.
//
// A GET with the right token also lets the report be triggered by hand, which
// is how you check it works without waiting until tomorrow morning.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { sendMail, parseRecipients } from "@/lib/mailer";
import { renderStockGridEmail } from "@/lib/stock-report-email";
import { pendingReservations, heldForProduct } from "@/lib/stock-reservations";
import { SITE } from "@/lib/site-config";
import { getAdminSession } from "@/lib/auth";
import { recordRun, STOCK_REPORT, type RunSource } from "@/lib/report-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Who is calling, or null if they may not.
 *
 * The answer is the caller's identity rather than a yes/no, because every run
 * is recorded and "did the 7am schedule fire?" is the question the record
 * exists to answer. A boolean would throw that away.
 */
async function authorised(request: NextRequest): Promise<RunSource | null> {
  // A signed-in admin may always run it — that is the "Email it to me now"
  // button on the Stock Grid page.
  if (await getAdminSession()) return "manual";

  const expected = process.env.REPORT_TOKEN;
  if (!expected) return null;

  const given =
    request.headers.get("x-report-token") ?? request.nextUrl.searchParams.get("token") ?? "";
  return Boolean(given) && tokenMatches(given, expected) ? "schedule" : null;
}

async function send(source: RunSource) {
  const products = await db.query.products.findMany({
    with: { images: true, sizes: true },
    orderBy: (p, { asc }) => [asc(p.name)],
  });

  // Garments already promised on an unconfirmed WhatsApp order. They are on
  // the shelf, so they stay in the count — but the email says how many of
  // each count are spoken for, because a number that includes them is the
  // reason the same kurti gets sold twice.
  const holds = await pendingReservations();

  // Inactive pieces are left out. The point of this email is what can be sold
  // this morning, and a piece that is not live cannot be.
  const report = renderStockGridEmail(
    products
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        slug: p.slug,
        isActive: p.isActive,
        images: p.images,
        sizes: p.sizes,
        held: heldForProduct(holds, p.id),
      })),
    { siteUrl: SITE.siteUrl }
  );

  // More than one person can want this. STOCK_REPORT_EMAIL takes a list:
  // "shilpa@example.com, lakshmi@example.com".
  const recipients = parseRecipients(process.env.STOCK_REPORT_EMAIL || process.env.CONTACT_NOTIFY_EMAIL);
  if (recipients.length === 0) {
    const error =
      "No recipient set. Put one or more addresses in STOCK_REPORT_EMAIL, separated by commas.";
    // Recorded, not just returned. A 7am run that failed for this reason is
    // invisible otherwise, and the silence looks exactly like a schedule that
    // never fired.
    await recordRun({ kind: STOCK_REPORT, source, ok: false, note: error });
    return { ok: false as const, error };
  }

  // sendMail used to return nothing whether it sent or silently skipped, so
  // this route reported "Sent to ..." on a site with no mail account
  // configured — the one thing it exists to be honest about.
  let result;
  try {
    result = await sendMail({ to: recipients.join(", "), subject: report.subject, text: report.text, html: report.html });
  } catch (err) {
    result = { sent: false as const, reason: err instanceof Error ? err.message : "The mail server refused the message." };
  }

  if (!result.sent) {
    await recordRun({ kind: STOCK_REPORT, source, ok: false, recipients, note: result.reason });
    return { ok: false as const, error: result.reason };
  }

  await recordRun({ kind: STOCK_REPORT, source, ok: true, recipients });

  return {
    ok: true as const,
    to: recipients,
    pieces: report.grid.rows.length,
    garments: report.grid.grandTotal,
  };
}

export async function GET(request: NextRequest) {
  const source = await authorised(request);
  if (!source) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  return NextResponse.json(await send(source));
}

export async function POST(request: NextRequest) {
  const source = await authorised(request);
  if (!source) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  return NextResponse.json(await send(source));
}
