// Sends transactional emails (contact-form alerts, etc.) via Gmail SMTP
// using an App Password. If GMAIL_USER / GMAIL_APP_PASSWORD aren't set,
// sending is silently skipped — callers should not let a missing/failed
// email block the actual save (e.g. a contact message is stored in the
// database regardless of whether the alert email goes out).

import nodemailer from "nodemailer";
import { appendFileSync } from "node:fs";

// Test-only escape hatch: when MAIL_OUTBOX_FILE is set, mail is appended to
// that file as JSON lines instead of being sent over SMTP, so the automated
// test suite can assert on what would have gone out. This variable is never
// set in production (and Netlify's filesystem is read-only anyway) — without
// it, nothing about the sending path below changes.
function writeToOutbox(file: string, opts: { to: string; subject: string; text: string; html?: string; replyTo?: string }) {
  try {
    appendFileSync(file, JSON.stringify({ ...opts, at: new Date().toISOString() }) + "\n");
  } catch (err) {
    console.error("mail outbox write failed:", err);
  }
}


/**
 * One or more addresses from a single setting.
 *
 * Shop mail goes to more than one person — both founders want the morning
 * stock report — but an environment variable is one string. Commas,
 * semicolons and newlines all separate, because whoever types it into the
 * hosting dashboard six months from now will use whichever they expect to
 * work, and none of them should silently produce a single broken address.
 *
 * Blanks and duplicates are dropped, and anything without an @ is left out
 * rather than handed to the mail server: one malformed entry can make a
 * provider reject the whole message, which would lose the good addresses too.
 */
export function parseRecipients(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const address = part.trim();
    if (!address || !address.includes("@") || address.includes(" ")) continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(address);
  }
  return out;
}

function getTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

/**
 * Whether the message actually went.
 *
 * This used to return nothing at all, and that was a real fault rather than an
 * omission. A missing Gmail password and a message delivered to two inboxes
 * were indistinguishable to every caller — so the stock report announced
 * "Sent to nagalakshmin@gmail.com, shilpahp298@gmail.com" on a site that could
 * not send email at all, and did so for days.
 *
 * Callers that must not fail because of email — an order being saved, a
 * contact message being stored — still ignore this and are still correct to.
 * Callers whose entire job IS the email have to be able to tell.
 */
export type MailResult = { sent: true } | { sent: false; reason: string };

/** Which half of the Gmail settings is missing, named individually. */
function missingMailSettings(): string[] {
  const missing: string[] = [];
  if (!process.env.GMAIL_USER) missing.push("GMAIL_USER");
  if (!process.env.GMAIL_APP_PASSWORD) missing.push("GMAIL_APP_PASSWORD");
  return missing;
}

/** True when this site can send email at all. */
export function mailConfigured(): boolean {
  return Boolean(process.env.MAIL_OUTBOX_FILE) || missingMailSettings().length === 0;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  /** Always required: the plain-text version, for clients that refuse HTML. */
  text: string;
  /** Optional richer version. A table of numbers is unreadable without it. */
  html?: string;
  replyTo?: string;
}): Promise<MailResult> {
  const outbox = process.env.MAIL_OUTBOX_FILE;
  if (outbox) {
    writeToOutbox(outbox, opts);
    return { sent: true };
  }

  const transport = getTransport();
  if (!transport) {
    const missing = missingMailSettings();
    const reason =
      `This site cannot send email: ${missing.join(" and ")} ` +
      `${missing.length === 1 ? "is" : "are"} not set. Nothing has been sent to anyone.`;
    console.warn(`sendMail skipped: ${reason}`);
    return { sent: false, reason };
  }
  const from = process.env.GMAIL_USER!;
  try {
    await transport.sendMail({
      from: `Urvi Studios Website <${from}>`,
      to: opts.to,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return { sent: true };
  } catch (err) {
    // Never let an email failure break the calling request — but say so,
    // rather than returning the same nothing a success returns.
    console.error("sendMail failed:", err);
    return { sent: false, reason: err instanceof Error ? err.message : "The mail server refused the message." };
  }
}
