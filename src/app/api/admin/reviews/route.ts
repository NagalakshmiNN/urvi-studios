import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const adminId = await getAdminSession();
  if (!adminId) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  let body: { reviewId: string; status: "APPROVED" | "REJECTED" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { reviewId, status } = body;
  if (!reviewId || !["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "reviewId and status (APPROVED or REJECTED) required." }, { status: 400 });
  }

  const review = await db.query.reviews.findFirst({ where: eq(schema.reviews.id, reviewId) });
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });

  await db.update(schema.reviews).set({ status }).where(eq(schema.reviews.id, reviewId));

  return NextResponse.json({ ok: true, reviewId, status });
}
