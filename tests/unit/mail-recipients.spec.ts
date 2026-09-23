// One setting, several people. Whoever types this into a hosting dashboard
// six months from now will use whichever separator they expect to work.

import { test, expect } from "@playwright/test";
import { parseRecipients } from "@/lib/mailer";

test("a single address comes through unchanged", () => {
  expect(parseRecipients("shilpa@example.com")).toEqual(["shilpa@example.com"]);
});

test("commas, semicolons and newlines all separate", () => {
  const expected = ["a@example.com", "b@example.com"];
  expect(parseRecipients("a@example.com,b@example.com")).toEqual(expected);
  expect(parseRecipients("a@example.com; b@example.com")).toEqual(expected);
  expect(parseRecipients("a@example.com\nb@example.com")).toEqual(expected);
});

test("spaces around addresses are trimmed", () => {
  // Copy-pasting a list out of a note almost always brings these.
  expect(parseRecipients("  a@example.com ,   b@example.com  ")).toEqual([
    "a@example.com",
    "b@example.com",
  ]);
});

test("a trailing separator doesn't produce an empty address", () => {
  // An empty entry handed to the mail server can make it reject the whole
  // message, which would lose the good addresses too.
  expect(parseRecipients("a@example.com,")).toEqual(["a@example.com"]);
  expect(parseRecipients(",,a@example.com,,")).toEqual(["a@example.com"]);
});

test("the same address twice is sent to once", () => {
  expect(parseRecipients("a@example.com, A@Example.com")).toEqual(["a@example.com"]);
});

test("something that isn't an address is left out, not passed on", () => {
  expect(parseRecipients("a@example.com, not-an-email, b@example.com")).toEqual([
    "a@example.com",
    "b@example.com",
  ]);
  expect(parseRecipients("has space@example.com")).toEqual([]);
});

test("nothing configured means nobody, not a broken send", () => {
  expect(parseRecipients(undefined)).toEqual([]);
  expect(parseRecipients(null)).toEqual([]);
  expect(parseRecipients("")).toEqual([]);
  expect(parseRecipients("   ")).toEqual([]);
});

test("order is kept, so the first address stays the main one", () => {
  expect(parseRecipients("lakshmi@example.com, shilpa@example.com")).toEqual([
    "lakshmi@example.com",
    "shilpa@example.com",
  ]);
});
