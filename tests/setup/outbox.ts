// Reads the mail outbox the app writes to when MAIL_OUTBOX_FILE is set (see
// src/lib/mailer.ts), so tests can assert that an email would actually have
// gone out, to whom, and roughly what it said — without sending anything.

import fs from "node:fs";
import { OUTBOX_FILE } from "./env";

export type SentMail = { to: string; subject: string; text: string; replyTo?: string; at: string };

export function readOutbox(): SentMail[] {
  if (!fs.existsSync(OUTBOX_FILE)) return [];
  return fs
    .readFileSync(OUTBOX_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SentMail);
}

/** Mail sent since a given marker (use `outboxLength()` before the action). */
export function outboxLength(): number {
  return readOutbox().length;
}

export function mailSince(marker: number): SentMail[] {
  return readOutbox().slice(marker);
}

/**
 * Emails are written by the server a moment after the response returns, so
 * poll briefly rather than assuming they've landed.
 */
export async function waitForMail(
  marker: number,
  predicate: (mail: SentMail) => boolean,
  timeoutMs = 8000
): Promise<SentMail> {
  const deadline = Date.now() + timeoutMs;
  let seen: SentMail[] = [];
  while (Date.now() < deadline) {
    seen = mailSince(marker);
    const found = seen.find(predicate);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(
    `No matching email arrived within ${timeoutMs}ms. Mail since marker:\n` +
      seen.map((m) => `  → ${m.to} — ${m.subject}`).join("\n")
  );
}
