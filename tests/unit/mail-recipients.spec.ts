// One setting, several people. Whoever types this into a hosting dashboard
// six months from now will use whichever separator they expect to work.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseRecipients, sendMail, mailConfigured } from "@/lib/mailer";

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

// ----------------------------------------------- Saying whether it actually sent
//
// sendMail used to return nothing at all, whether the message went to two
// inboxes or was silently dropped because no Gmail account was configured.
// Every caller was blind to the difference, and the stock report announced
// "Sent to nagalakshmin@gmail.com, shilpahp298@gmail.com" on a live site that
// could not send email — and kept announcing it for days.

test("with no mail account, sending reports failure and names what is missing", async () => {
  const saved = {
    outbox: process.env.MAIL_OUTBOX_FILE,
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  };
  delete process.env.MAIL_OUTBOX_FILE;
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;

  try {
    expect(mailConfigured()).toBe(false);

    const result = await sendMail({ to: "someone@example.com", subject: "Stock", text: "..." });
    expect(result.sent).toBe(false);
    // Both settings named, so neither gets checked and the other missed.
    expect(result.sent === false && result.reason).toContain("GMAIL_USER");
    expect(result.sent === false && result.reason).toContain("GMAIL_APP_PASSWORD");
    // And it says plainly that nobody got anything, because the old silence
    // read as success.
    expect(result.sent === false && result.reason).toContain("Nothing has been sent");
  } finally {
    if (saved.outbox) process.env.MAIL_OUTBOX_FILE = saved.outbox;
    if (saved.user) process.env.GMAIL_USER = saved.user;
    if (saved.pass) process.env.GMAIL_APP_PASSWORD = saved.pass;
  }
});

test("only the missing half is named when only one is missing", async () => {
  const saved = { outbox: process.env.MAIL_OUTBOX_FILE, user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD };
  delete process.env.MAIL_OUTBOX_FILE;
  process.env.GMAIL_USER = "shop@example.com";
  delete process.env.GMAIL_APP_PASSWORD;

  try {
    const result = await sendMail({ to: "someone@example.com", subject: "Stock", text: "..." });
    expect(result.sent).toBe(false);
    expect(result.sent === false && result.reason).toContain("GMAIL_APP_PASSWORD is not set");
    expect(result.sent === false && result.reason).not.toContain("GMAIL_USER and");
  } finally {
    if (saved.outbox) process.env.MAIL_OUTBOX_FILE = saved.outbox;
    if (saved.user) process.env.GMAIL_USER = saved.user;
    else delete process.env.GMAIL_USER;
    if (saved.pass) process.env.GMAIL_APP_PASSWORD = saved.pass;
  }
});

test("the test outbox still counts as sent, so the suite is not testing a broken path", async () => {
  // Every other test in this repo asserts on the outbox file that the running
  // app writes. If that path ever reported failure, those assertions would be
  // checking nothing — so it is pinned here, in the unit process, by pointing
  // at a scratch file of its own.
  const saved = process.env.MAIL_OUTBOX_FILE;
  const scratch = path.join(os.tmpdir(), `urvi-outbox-check-${process.pid}.jsonl`);
  process.env.MAIL_OUTBOX_FILE = scratch;

  try {
    expect(mailConfigured()).toBe(true);
    const result = await sendMail({ to: "outbox@example.com", subject: "Outbox check", text: "..." });
    expect(result.sent).toBe(true);
    expect(fs.readFileSync(scratch, "utf8")).toContain("outbox@example.com");
  } finally {
    if (saved) process.env.MAIL_OUTBOX_FILE = saved;
    else delete process.env.MAIL_OUTBOX_FILE;
    fs.rmSync(scratch, { force: true });
  }
});
