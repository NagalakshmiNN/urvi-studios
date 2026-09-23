// Fires the daily stock email.
//
// A Netlify scheduled function rather than anything inside the Next app,
// because the app only runs when a request arrives — there is nothing in it
// that wakes up at seven in the morning on its own.
//
// It does no work itself: it calls the app's own report route, which holds
// the database access and the rendering. Splitting it that way means the
// report can also be triggered by hand from the admin, and only one piece of
// code decides what the email says.

import type { Config } from "@netlify/functions";

export default async () => {
  const base = process.env.URL ?? "https://urvi-studios.netlify.app";
  const token = process.env.REPORT_TOKEN;

  if (!token) {
    console.error("[stock-report] REPORT_TOKEN is not set — cannot call the report route.");
    return new Response("REPORT_TOKEN missing", { status: 500 });
  }

  const res = await fetch(`${base}/api/reports/stock-daily`, {
    method: "POST",
    headers: { "x-report-token": token },
  });

  const body = await res.text();
  console.log(`[stock-report] ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};

export const config: Config = {
  // 01:30 UTC is 07:00 in India — on the desk before the day starts.
  // Netlify schedules are always UTC.
  schedule: "30 1 * * *",
};
