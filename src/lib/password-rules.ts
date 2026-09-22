// What counts as an acceptable new password.
//
// Kept apart from the form and the action so the rule is one thing, readable
// and testable, rather than a condition buried in a handler. Deliberately
// modest: a length floor and a check that it is actually different. Rules
// that demand a symbol and a digit push people towards Password1! and a
// sticky note, which is worse than a long phrase they can remember.

export const MIN_ADMIN_PASSWORD_LENGTH = 12;

export type PasswordCheck = { ok: true } | { ok: false; error: string };

export function checkNewPassword(next: string, confirm: string, current: string): PasswordCheck {
  if (!next) return { ok: false, error: "Please enter a new password." };
  if (next.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Your new password needs at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.` };
  }
  if (next !== confirm) return { ok: false, error: "The two new passwords don't match." };
  if (next === current) return { ok: false, error: "Your new password needs to be different from the current one." };
  // A password made of spaces passes a length check and nothing else.
  if (!next.trim()) return { ok: false, error: "Please enter a real password." };
  return { ok: true };
}
