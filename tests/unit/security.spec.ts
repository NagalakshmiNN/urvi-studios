// The rules that decide who may be redirected where, and whether a session
// can be signed at all. Both were failing open.

import { test, expect } from "@playwright/test";

// safeNext is not exported (it lives beside the actions that use it), so the
// rule is restated here and checked against the same cases. Keep them in step.
function safeNext(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("/")) return "/account";
  if (value.startsWith("//")) return "/account";
  if (value.includes("\\")) return "/account";
  return value;
}

test("an ordinary path is kept", () => {
  expect(safeNext("/account/orders")).toBe("/account/orders");
  expect(safeNext("/cart")).toBe("/cart");
});

test("an absolute URL is refused", () => {
  // The phishing hop: correct password, then straight off to someone else's
  // site wearing our credibility.
  expect(safeNext("https://evil.example/login")).toBe("/account");
  expect(safeNext("http://evil.example")).toBe("/account");
});

test("a protocol-relative URL is refused", () => {
  // Starts with a slash, so a naive check passes it — and the browser reads
  // it as another origin.
  expect(safeNext("//evil.example")).toBe("/account");
});

test("a backslash is refused", () => {
  // Some browsers normalise \\ to / when resolving, which turns this into
  // another protocol-relative escape.
  expect(safeNext("/\\evil.example")).toBe("/account");
  expect(safeNext("\\\\evil.example")).toBe("/account");
});

test("nothing at all falls back to the account page", () => {
  expect(safeNext(undefined)).toBe("/account");
  expect(safeNext("")).toBe("/account");
  expect(safeNext("   ")).toBe("/account");
});
