// How many guesses a password gets, and for how long.

import { test, expect } from "@playwright/test";
import { evaluate, attemptKey, lockoutMessage, MAX_ATTEMPTS, WINDOW_MINUTES } from "@/lib/login-throttle";

const NOW = new Date("2026-09-22T12:00:00Z");
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);

test("a clean slate allows the full run of attempts", () => {
  const s = evaluate([], NOW);
  expect(s.allowed).toBe(true);
  expect(s.remaining).toBe(MAX_ATTEMPTS);
});

test("one short of the limit is still allowed", () => {
  const s = evaluate([1, 2, 3, 4].map(minutesAgo), NOW);
  expect(s.allowed).toBe(true);
  expect(s.remaining).toBe(1);
});

test("the limit closes the door", () => {
  const s = evaluate([1, 2, 3, 4, 5].map(minutesAgo), NOW);
  expect(s.allowed).toBe(false);
  expect(s.remaining).toBe(0);
  expect(s.retryAfterMinutes).toBeGreaterThan(0);
});

test("failures older than the window don't count", () => {
  // Five failures, but all yesterday. Somebody who mistyped their password
  // last week should not arrive locked out today.
  const s = evaluate([1, 2, 3, 4, 5].map((n) => minutesAgo(WINDOW_MINUTES + n)), NOW);
  expect(s.allowed).toBe(true);
  expect(s.remaining).toBe(MAX_ATTEMPTS);
});

test("the lockout is rolling, not fixed", () => {
  // Five failures, the oldest 14 minutes ago. One more minute and it ages
  // out, so the wait is a minute — not a fresh fifteen.
  const times = [14, 13, 12, 11, 10].map(minutesAgo);
  const s = evaluate(times, NOW);
  expect(s.allowed).toBe(false);
  expect(s.retryAfterMinutes).toBe(1);
});

test("a long run of failures still reports a sane wait", () => {
  // Twenty failures in the last minute. The wait is measured from the fifth
  // most recent, not the first — otherwise the number reported would be
  // whatever the attacker's timing happened to make it.
  const times = Array.from({ length: 20 }, (_, i) => minutesAgo(i * 0.05));
  const s = evaluate(times, NOW);
  expect(s.allowed).toBe(false);
  expect(s.retryAfterMinutes).toBeGreaterThan(0);
  expect(s.retryAfterMinutes).toBeLessThanOrEqual(WINDOW_MINUTES);
});

test("the key is scoped by kind and normalised email", () => {
  // The same person typing their address with capitals or a stray space must
  // land on the same counter, or the limit is trivially sidestepped.
  expect(attemptKey("admin", "Owner@Example.COM ")).toBe("admin:owner@example.com");
  expect(attemptKey("customer", "owner@example.com")).toBe("customer:owner@example.com");
  expect(attemptKey("admin", "a@b.com")).not.toBe(attemptKey("customer", "a@b.com"));
});

test("the lockout message says nothing about whether the account exists", () => {
  const msg = lockoutMessage({ allowed: false, remaining: 0, retryAfterMinutes: 3 });
  expect(msg).toContain("3 minutes");
  expect(msg.toLowerCase()).not.toContain("account");
  expect(msg.toLowerCase()).not.toContain("email");
});

test("one minute is singular", () => {
  expect(lockoutMessage({ allowed: false, remaining: 0, retryAfterMinutes: 1 })).toContain("1 minute and");
});
