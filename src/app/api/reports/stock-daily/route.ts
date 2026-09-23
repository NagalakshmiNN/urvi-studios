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
import { SITE } from "@/lib/site-config";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function authorised(request: NextRequest): Promise<boolean> {
  // A signed-in admin may always run it — that is the "send it to me now"
  // button on the Stock Grid page.
  if (await getAdminSession()) return true;

  const expected = process.env.REPORT_TOKEN;
  if (!expected) return false;

  const given =
    request.headers.get("x-report-token") ?? request.nextUrl.searchParams.get("token") ?? "";
  return Boolean(given) && tokenMatches(given, expected);
}

async function send() {
  const products = await db.query.products.findMany({
    with: { images: true, sizes: true },
    orderBy: (p, { asc }) => [asc(p.name)],
  });

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
      })),
    { siteUrl: SITE.siteUrl }
  );

  // More than one person can want this. STOCK_REPORT_EMAIL takes a list:
  // "shilpa@example.com, lakshmi@example.com".
  const recipients = parseRecipients(process.env.STOCK_REPORT_EMAIL || process.env.CONTACT_NOTIFY_EMAIL);
  if (recipients.length === 0) {
    return {
      ok: false as const,
      error:
        "No recipient set. Put one or more addresses in STOCK_REPORT_EMAIL, separated by commas.",
    };
  }

  await sendMail({ to: recipients.join(", "), subject: report.subject, text: report.text, html: report.html });

  return {
    ok: true as const,
    to: recipients,
    pieces: report.grid.rows.length,
    garments: report.grid.grandTotal,
  };
}

export async function GET(request: NextRequest) {
  if (!(await authorised(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json(await send());
}

export async function POST(request: NextRequest) {
  if (!(await authorised(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json(await send());
}
