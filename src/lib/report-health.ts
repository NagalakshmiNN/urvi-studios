// Whether the morning report is actually set up, and whether it ever ran.
//
// The stock email was built, tested by hand, and then did not arrive at seven
// the next morning. Nothing on the site could say why, because the two
// possible causes look identical from the outside: the schedule never fired,
// or it fired and the send failed. The only record was in the hosting
// dashboard's function logs — which is exactly the hunt the build stamp was
// added to put an end to.
//
// So two things live here. A record of every run, written by the report route
// itself whether it succeeds or fails; and a plain reading of whether the
// settings it depends on are present. Between them, "why didn't I get my
// email?" is answered by looking at a screen.

import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { parseRecipients } from "./mailer";

export const STOCK_REPORT = "stock-daily";

export type RunSource = "schedule" | "manual";

/**
 * Record a run. Never throws.
 *
 * A failure to write the log must not turn a working report into a broken one
 * — the email matters more than the note about the email.
 */
export async function recordRun(opts: {
  kind: string;
  source: RunSource;
  ok: boolean;
  recipients?: string[];
  note?: string | null;
}): Promise<void> {
  try {
    await db.insert(schema.reportRuns).values({
      kind: opts.kind,
      source: opts.source,
      ok: opts.ok,
      recipients: (opts.recipients ?? []).join(", "),
      note: opts.note ?? null,
    });
  } catch (err) {
    console.error("[report-health] could not record the run:", err);
  }
}

export type RunRow = {
  source: string;
  ok: boolean;
  recipients: string;
  note: string | null;
  ranAt: Date;
};

export async function recentRuns(kind: string, limit = 8): Promise<RunRow[]> {
  return db
    .select({
      source: schema.reportRuns.source,
      ok: schema.reportRuns.ok,
      recipients: schema.reportRuns.recipients,
      note: schema.reportRuns.note,
      ranAt: schema.reportRuns.ranAt,
    })
    .from(schema.reportRuns)
    .where(eq(schema.reportRuns.kind, kind))
    .orderBy(desc(schema.reportRuns.ranAt))
    .limit(limit);
}

export type ReportHealth = {
  /** Addresses the report would go to, as the server sees them right now. */
  recipients: string[];
  /** Whether STOCK_REPORT_EMAIL (or the contact fallback) held anything usable. */
  recipientsSet: boolean;
  /** Set but unusable — somebody typed a name instead of an address, say. */
  recipientsUnusable: boolean;
  /** Whether the schedule could authenticate itself if it called. */
  tokenSet: boolean;
  /** Whether mail can be sent at all. */
  mailConfigured: boolean;
  lastRun: RunRow | null;
  lastScheduledRun: RunRow | null;
};

/**
 * What the server itself can see.
 *
 * Read on the server and shown in the admin, because the settings live in the
 * hosting dashboard where a value can be present, saved, and still not reach
 * the running code — the wrong deploy context, or the wrong scope ticked. The
 * only reading that settles it is the one taken from inside the function that
 * needs the value.
 */
export async function stockReportHealth(): Promise<ReportHealth> {
  const raw = process.env.STOCK_REPORT_EMAIL || process.env.CONTACT_NOTIFY_EMAIL || "";
  const recipients = parseRecipients(raw);
  const runs = await recentRuns(STOCK_REPORT, 8);

  return {
    recipients,
    recipientsSet: recipients.length > 0,
    // Distinguished on purpose: "nothing set" and "set to something that
    // isn't an address" need different fixes, and lumping them together is
    // how somebody spends an evening re-entering a value that was already there.
    recipientsUnusable: raw.trim().length > 0 && recipients.length === 0,
    tokenSet: Boolean(process.env.REPORT_TOKEN),
    mailConfigured: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    lastRun: runs[0] ?? null,
    lastScheduledRun: runs.find((r) => r.source === "schedule") ?? null,
  };
}

/**
 * The one sentence that says what to do next.
 *
 * Ordered by what blocks what: a report with nowhere to send it cannot work
 * however well the schedule fires, and a schedule that has never fired is a
 * different problem from a send that failed.
 */
export function diagnosis(health: ReportHealth): { fine: boolean; message: string } {
  if (health.recipientsUnusable) {
    return {
      fine: false,
      message:
        "STOCK_REPORT_EMAIL is set but holds nothing that looks like an email address. " +
        "Separate several addresses with commas.",
    };
  }
  if (!health.recipientsSet) {
    return {
      fine: false,
      message:
        "No recipient. Set STOCK_REPORT_EMAIL in Netlify (Production context, Functions and " +
        "Runtime ticked, Builds unticked) and redeploy — an environment variable only reaches " +
        "the site on the next deploy.",
    };
  }
  if (!health.mailConfigured) {
    return { fine: false, message: "Mail isn't configured — GMAIL_USER or GMAIL_APP_PASSWORD is missing." };
  }
  if (!health.tokenSet) {
    return {
      fine: false,
      message:
        "REPORT_TOKEN isn't set, so the 7am schedule cannot authenticate itself. " +
        "The button below still works, because your admin session authorises it.",
    };
  }
  if (!health.lastScheduledRun) {
    return {
      fine: false,
      message:
        "Everything is configured, but the 7am schedule has never called this report. " +
        "That points at the scheduled function not being deployed rather than at the email.",
    };
  }
  if (!health.lastScheduledRun.ok) {
    return {
      fine: false,
      message: `The 7am run failed: ${health.lastScheduledRun.note ?? "no reason recorded"}`,
    };
  }
  return { fine: true, message: "The 7am report ran and was sent." };
}
