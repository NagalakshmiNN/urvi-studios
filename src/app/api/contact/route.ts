import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { sendMail } from "@/lib/mailer";
import { allowRequest, callerKey } from "@/lib/login-throttle";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

  const name = String(body.name || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().slice(0, 200);
  const message = String(body.message || "").trim().slice(0, 4000);

  if (!name || !email || !message) {
    return NextResponse.json({ ok: false, error: "Name, email, and message are all required." }, { status: 400 });
  }

  // Every call writes a row and sends mail through the shop's own Gmail
  // account, with a subject and body chosen by the caller. Unthrottled, that
  // is a way to fill the Messages screen and to get the sending address
  // rate-limited or suspended by Google — the shop's own order confirmations
  // go through the same account.
  if (!(await allowRequest(callerKey("contact", request.headers), 5))) {
    return NextResponse.json(
      { ok: false, error: "That's a few messages in a short while — please give it a few minutes and try again." },
      { status: 429 }
    );
  }

  await db.insert(schema.contactMessages).values({ name, email, message });

  // Best-effort alert email — the message is already saved above regardless
  // of whether this succeeds, so a mail outage never loses a customer note.
  const notifyTo = process.env.CONTACT_NOTIFY_EMAIL;
  if (notifyTo) {
    await sendMail({
      to: notifyTo,
      replyTo: email,
      subject: `New website message from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}\n\n— Sent via the Urvi Studios contact form. Just hit Reply to write back to them directly, or view it in the admin dashboard under Messages.`,
    });
  }

  return NextResponse.json({ ok: true });
}
