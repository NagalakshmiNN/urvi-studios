// Sends transactional emails (contact-form alerts, etc.) via Gmail SMTP
// using an App Password. If GMAIL_USER / GMAIL_APP_PASSWORD aren't set,
// sending is silently skipped — callers should not let a missing/failed
// email block the actual save (e.g. a contact message is stored in the
// database regardless of whether the alert email goes out).

import nodemailer from "nodemailer";

function getTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendMail(opts: { to: string; subject: string; text: string; replyTo?: string }) {
  const transport = getTransport();
  if (!transport) {
    console.warn("sendMail skipped: GMAIL_USER/GMAIL_APP_PASSWORD not configured.");
    return;
  }
  const from = process.env.GMAIL_USER!;
  try {
    await transport.sendMail({
      from: `Urvi Studios Website <${from}>`,
      to: opts.to,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
    });
  } catch (err) {
    // Never let an email failure break the calling request.
    console.error("sendMail failed:", err);
  }
}
