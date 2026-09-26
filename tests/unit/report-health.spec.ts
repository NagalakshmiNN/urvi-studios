// What the admin is told about the morning email.
//
// The report was built, tested by hand, and then did not arrive at seven the
// next morning — and nothing on the site could say which half had failed.
// These are the sentences that replace that guessing, so the order they come
// in is the behaviour: each one has to name the thing that is actually
// blocking, not the next thing down the list.

import { test, expect } from "@playwright/test";
import { diagnosis, type ReportHealth } from "@/lib/report-health";

const good: ReportHealth = {
  recipients: ["shop@example.com"],
  recipientsSet: true,
  recipientsUnusable: false,
  tokenSet: true,
  mailConfigured: true,
  missingMailSettings: [],
  lastRun: { source: "schedule", ok: true, recipients: "shop@example.com", note: null, ranAt: new Date() },
  lastScheduledRun: { source: "schedule", ok: true, recipients: "shop@example.com", note: null, ranAt: new Date() },
};

test("a working report says so and stops", () => {
  const v = diagnosis(good);
  expect(v.fine).toBe(true);
});

test("no recipient is named before anything else", () => {
  // A report with nowhere to send it cannot work however perfectly the
  // schedule fires, so this has to be the first thing said.
  const v = diagnosis({ ...good, recipients: [], recipientsSet: false, tokenSet: false, lastScheduledRun: null });
  expect(v.fine).toBe(false);
  expect(v.message).toContain("STOCK_REPORT_EMAIL");
  // And it must say the part people miss: a new variable needs a redeploy.
  expect(v.message).toContain("redeploy");
});

test("a recipient set to something that isn't an address is its own message", () => {
  // "Not set" and "set to nonsense" need different fixes. Lumping them
  // together is how somebody spends an evening re-entering a value that was
  // already there.
  const v = diagnosis({ ...good, recipients: [], recipientsSet: false, recipientsUnusable: true });
  expect(v.message).toContain("nothing that looks like an email");
});

test("no mail account is reported as the whole site, not as a report fault", () => {
  // The card once said "Mail isn't configured" and, on the very same line,
  // "Sent to nagalakshmin@gmail.com" — because sendMail returned the same
  // nothing whether it sent or skipped. Worse, the message made it sound like
  // a stock-report setting. With no mail account, every email the site sends
  // is going nowhere, including a customer's order confirmation.
  const v = diagnosis({ ...good, mailConfigured: false, missingMailSettings: ["GMAIL_APP_PASSWORD"] });
  expect(v.fine).toBe(false);
  expect(v.message).toContain("GMAIL_APP_PASSWORD");
  expect(v.message).toContain("Order confirmations");
  // Both missing reads as a list, not as "GMAIL_USER, GMAIL_APP_PASSWORD is".
  const both = diagnosis({
    ...good,
    mailConfigured: false,
    missingMailSettings: ["GMAIL_USER", "GMAIL_APP_PASSWORD"],
  });
  expect(both.message).toContain("GMAIL_USER and GMAIL_APP_PASSWORD are not set");
});

test("a missing token blames the schedule, not the button", () => {
  const v = diagnosis({ ...good, tokenSet: false, lastScheduledRun: null });
  expect(v.message).toContain("REPORT_TOKEN");
  // The distinction that saves a wasted test: pressing the button still works,
  // because the admin session authorises it. Someone who didn't know that
  // would press it, see it succeed, and conclude the schedule was fine.
  expect(v.message).toContain("button below still works");
});

test("a schedule that has never fired is called out as a deploy problem", () => {
  // The most useful line on the card. Everything configured and no run on
  // record means the scheduled function isn't deployed — which is fixed
  // somewhere completely different from an email fault.
  const v = diagnosis({ ...good, lastScheduledRun: null });
  expect(v.fine).toBe(false);
  expect(v.message).toContain("never called this report");
});

test("a failed 7am run repeats the reason it failed", () => {
  const v = diagnosis({
    ...good,
    lastScheduledRun: {
      source: "schedule",
      ok: false,
      recipients: "",
      note: "Invalid login: 535 authentication failed",
      ranAt: new Date(),
    },
  });
  expect(v.fine).toBe(false);
  // Repeated verbatim rather than summarised — the provider's own words are
  // what a search engine finds an answer for.
  expect(v.message).toContain("535 authentication failed");
});
