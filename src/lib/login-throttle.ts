// Slowing down someone guessing a password.
//
// A sign-in form with no limit is a password cracker's front door: a script
// can try tens of thousands of guesses an hour against a known email address
// and nothing here would notice. That mattered more than usual for this site,
// because the seeded admin password had been committed to the repository —
// anyone who read it did not need to guess at all.
//
// The counting rule is separated from the database so it can be read and
// tested on its own. The rule is the part that has to be right; the storage
// is just where the numbers live.

import { and, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** Failures allowed inside the window before the door closes. */
export const MAX_ATTEMPTS = 5;

/** How far back failures are counted, and how long a lockout lasts. */
export const WINDOW_MINUTES = 15;

export type ThrottleState = { allowed: boolean; remaining: number; retryAfterMinutes: number };

/**
 * Whether a sign-in may be attempted, given how many failures are already on
 * record and when the oldest one in the window happened.
 *
 * The lockout is rolling rather than fixed: it lifts when the oldest failure
 * ages out of the window, so someone who mistyped their password five times
 * waits minutes rather than being shut out until some arbitrary hour passes.
 */
export function evaluate(failureTimes: Date[], now: Date = new Date()): ThrottleState {
  const cutoff = now.getTime() - WINDOW_MINUTES * 60_000;
  const recent = failureTimes.filter((t) => t.getTime() > cutoff).sort((a, b) => a.getTime() - b.getTime());

  if (recent.length < MAX_ATTEMPTS) {
    return { allowed: true, remaining: MAX_ATTEMPTS - recent.length, retryAfterMinutes: 0 };
  }

  // Locked. The wait is until the oldest counted failure falls out of the
  // window — at which point there is room for one more try.
  const oldest = recent[recent.length - MAX_ATTEMPTS];
  const freeAt = oldest.getTime() + WINDOW_MINUTES * 60_000;
  const minutes = Math.max(1, Math.ceil((freeAt - now.getTime()) / 60_000));
  return { allowed: false, remaining: 0, retryAfterMinutes: minutes };
}

/**
 * The key a run of failures is counted against.
 *
 * Scoped to the account, not the caller's address. A shared office, a college
 * or a mobile network puts many honest people behind one IP, and locking all
 * of them out to stop one guesser is its own kind of failure. The trade-off
 * is that an attacker spreading guesses across many accounts is not caught by
 * this — that is what the password rules and the audit are for.
 */
export function attemptKey(kind: "admin" | "customer", email: string): string {
  return `${kind}:${email.trim().toLowerCase()}`;
}

/** How a sign-in stands right now. */
export async function checkThrottle(key: string): Promise<ThrottleState> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  const rows = await db
    .select({ createdAt: schema.authAttempts.createdAt })
    .from(schema.authAttempts)
    .where(and(eq(schema.authAttempts.attemptKey, key), gt(schema.authAttempts.createdAt, since)));
  return evaluate(rows.map((r) => r.createdAt));
}

export async function recordFailure(key: string): Promise<void> {
  await db.insert(schema.authAttempts).values({ attemptKey: key });
}

/** A correct password wipes the slate, so honest mistakes never accumulate. */
export async function clearAttempts(key: string): Promise<void> {
  await db.delete(schema.authAttempts).where(eq(schema.authAttempts.attemptKey, key));
}

/**
 * Housekeeping. Rows older than the window can never affect a decision, and
 * without this the table grows forever. Run opportunistically on failures
 * rather than on a schedule, because this site has no scheduler.
 */
export async function pruneOldAttempts(): Promise<void> {
  await db.delete(schema.authAttempts).where(
    sql`${schema.authAttempts.createdAt} < now() - interval '1 day'`
  );
}

/** What the person is told. Never says whether the account exists. */
export function lockoutMessage(state: ThrottleState): string {
  return (
    `Too many sign-in attempts. Please wait ${state.retryAfterMinutes} minute` +
    `${state.retryAfterMinutes === 1 ? "" : "s"} and try again.`
  );
}
