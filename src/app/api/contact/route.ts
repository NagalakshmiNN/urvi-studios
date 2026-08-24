import { NextResponse } from "next/server";
import { db, schema } from "@/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

  const name = String(body.name || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().slice(0, 200);
  const message = String(body.message || "").trim().slice(0, 4000);

  if (!name || !email || !message) {
    return NextResponse.json({ ok: false, error: "Name, email, and message are all required." }, { status: 400 });
  }

  await db.insert(schema.contactMessages).values({ name, email, message });
  return NextResponse.json({ ok: true });
}
