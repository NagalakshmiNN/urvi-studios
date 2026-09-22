// What may become an admin password.

import { test, expect } from "@playwright/test";
import { checkNewPassword, MIN_ADMIN_PASSWORD_LENGTH } from "@/lib/password-rules";

const CURRENT = "old-password-here";

test("a long enough, different, matching password is accepted", () => {
  expect(checkNewPassword("seven green bicycles", "seven green bicycles", CURRENT)).toEqual({ ok: true });
});

test("too short is refused, with the length named", () => {
  const r = checkNewPassword("short", "short", CURRENT);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toContain(String(MIN_ADMIN_PASSWORD_LENGTH));
});

test("a mistyped confirmation is caught", () => {
  const r = checkNewPassword("seven green bicycles", "seven green bicycle", CURRENT);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toContain("don't match");
});

test("reusing the current password is refused", () => {
  // Otherwise "change your password" can be satisfied without changing it,
  // which is exactly what someone does when told to rotate a leaked one.
  const r = checkNewPassword(CURRENT, CURRENT, CURRENT);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toContain("different");
});

test("spaces are not a password", () => {
  const r = checkNewPassword("               ", "               ", CURRENT);
  expect(r.ok).toBe(false);
});

test("an empty field asks for a password rather than complaining about length", () => {
  const r = checkNewPassword("", "", CURRENT);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toBe("Please enter a new password.");
});
