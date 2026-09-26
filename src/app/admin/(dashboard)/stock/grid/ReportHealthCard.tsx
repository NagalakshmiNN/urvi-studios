// Why the seven o'clock email did or didn't arrive.
//
// Rendered on the server so every reading is taken from inside the function
// that actually needs the value. A setting can be typed into the hosting
// dashboard, saved, and still not reach the running code — the wrong deploy
// context, the wrong scope ticked, or a deploy that hasn't happened since. The
// dashboard will happily show you the value in all three cases.

import { stockReportHealth, diagnosis, STOCK_REPORT, recentRuns } from "@/lib/report-health";
import SendStockEmail from "./SendStockEmail";

/** An address with its middle removed, so a screenshot is safe to send. */
function mask(address: string): string {
  const [name, domain] = address.split("@");
  if (!domain) return address;
  const head = name.slice(0, 2);
  return `${head}${name.length > 2 ? "…" : ""}@${domain}`;
}

function when(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default async function ReportHealthCard() {
  const health = await stockReportHealth();
  const verdict = diagnosis(health);
  const runs = await recentRuns(STOCK_REPORT, 6);

  const tone = verdict.fine ? "#3f6b3a" : "#a03c28";

  return (
    <div className="admin-card" style={{ padding: "16px 20px", marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>The 7am email</h3>
        <span style={{ fontSize: 13, color: tone, fontWeight: 600 }}>{verdict.message}</span>
      </div>

      <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", fontSize: 13, lineHeight: 1.9 }}>
        <li>
          <strong>Goes to:</strong>{" "}
          {health.recipients.length > 0 ? (
            health.recipients.map(mask).join(", ")
          ) : (
            <span style={{ color: "#a03c28" }}>nobody — STOCK_REPORT_EMAIL is not set</span>
          )}
        </li>
        <li>
          <strong>Schedule can sign in:</strong>{" "}
          {health.tokenSet ? "yes" : <span style={{ color: "#a03c28" }}>no — REPORT_TOKEN is not set</span>}
        </li>
        <li>
          <strong>Mail account:</strong>{" "}
          {health.mailConfigured ? "connected" : <span style={{ color: "#a03c28" }}>not configured</span>}
        </li>
        <li>
          <strong>Last 7am run:</strong>{" "}
          {health.lastScheduledRun ? (
            <>
              {when(health.lastScheduledRun.ranAt)} — {health.lastScheduledRun.ok ? "sent" : "failed"}
            </>
          ) : (
            // The single most useful line on this card. An empty record means
            // nothing ever called the report, which is a deploy problem and
            // not an email problem — and those get fixed in different places.
            <span style={{ color: "#a03c28" }}>never — the schedule has not called this report once</span>
          )}
        </li>
      </ul>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <SendStockEmail />
        <span style={{ fontSize: 12.5, color: "var(--sage)" }}>
          Sends the same email the schedule sends, to the same people.
        </span>
      </div>

      {runs.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary style={{ fontSize: 12.5, color: "var(--sage)", cursor: "pointer" }}>
            Every run so far ({runs.length})
          </summary>
          <table className="admin-table" style={{ marginTop: 10 }}>
            <thead>
              <tr><th>When</th><th>Triggered by</th><th>Result</th><th>Sent to</th></tr>
            </thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>{when(r.ranAt)}</td>
                  <td>{r.source === "schedule" ? "7am schedule" : "by hand"}</td>
                  <td style={{ color: r.ok ? undefined : "#a03c28" }}>
                    {r.ok ? "Sent" : r.note || "Failed"}
                  </td>
                  <td>{r.recipients ? r.recipients.split(", ").map(mask).join(", ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
