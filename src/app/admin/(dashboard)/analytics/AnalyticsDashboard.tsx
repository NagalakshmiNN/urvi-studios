"use client";

import { useState, useEffect, useCallback } from "react";

// Colour palette — tuned against the brand's ivory background, checked for
// contrast and colour-blindness separation (same approach as MonthlyRevenueChart).
const C = {
  teal: "#00806B",
  gold: "#A98238",
  olive: "#3F4827",
  sage: "#6A7444",
  red: "#a5333a",
  blue: "#2a6496",
  ivory: "#F7F0E4",
  sand: "#EFE4D0",
  line: "rgba(63,72,39,0.13)",
};

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

// Quick date helpers
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function toISO(d: Date) { return d.toISOString().slice(0, 10); }
const TODAY = toISO(new Date());

// ---- Mini bar chart (SVG) ----
function BarChart({
  data,
  color = C.teal,
  height = 180,
  label,
}: {
  data: { day: string; count: number }[];
  color?: string;
  height?: number;
  label: string;
}) {
  if (data.length === 0) {
    return <p style={{ color: "var(--sage)", fontSize: 13 }}>No data in this range.</p>;
  }

  const W = 680;
  const H = height;
  const PAD = { top: 16, right: 8, bottom: 32, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const peak = Math.max(...data.map((d) => d.count), 1);
  const slot = plotW / data.length;
  const barW = Math.max(3, Math.min(16, slot - 3));

  const ticks = [0, Math.round(peak * 0.5), peak];
  const y = (v: number) => PAD.top + ((peak - v) / peak) * plotH;

  // Show at most 10 day labels along the x-axis
  const labelEvery = Math.max(1, Math.ceil(data.length / 10));

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={C.line} />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" style={{ fontSize: 10, fill: C.sage }}>{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.left + i * slot + slot / 2;
          const barH = Math.max(1, (d.count / peak) * plotH);
          return (
            <g key={d.day}>
              <rect x={cx - barW / 2} y={y(d.count)} width={barW} height={barH} rx={2} fill={color} opacity={0.85}>
                <title>{`${d.day}: ${d.count}`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 10} textAnchor="middle" style={{ fontSize: 9, fill: C.sage }}>
                  {d.day.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---- Horizontal bar chart for top pages ----
function HBar({ data, max }: { data: { name: string; views: number }[]; max: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d) => (
        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 200, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={d.name}>
            {d.name}
          </span>
          <div style={{ flex: 1, height: 18, background: C.sand, borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.max(2, (d.views / max) * 100)}%`,
                height: "100%",
                background: C.teal,
                borderRadius: 4,
                transition: "width 0.3s",
              }}
            />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 36, textAlign: "right" }}>{d.views}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Donut chart for payment breakdown ----
function Donut({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;
  const R = 64;
  const CIRC = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <svg width={160} height={160} viewBox="0 0 160 160">
        {slices.map((sl) => {
          const pct = sl.value / total;
          const dash = pct * CIRC;
          const o = offset;
          offset += dash;
          return (
            <circle
              key={sl.label}
              cx="80" cy="80" r={R}
              fill="none"
              stroke={sl.color}
              strokeWidth="24"
              strokeDasharray={`${dash} ${CIRC - dash}`}
              strokeDashoffset={-o}
              style={{ transition: "stroke-dasharray 0.3s" }}
            >
              <title>{`${sl.label}: ${sl.value}`}</title>
            </circle>
          );
        })}
        <text x="80" y="80" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 18, fontWeight: 600, fill: C.olive }}>
          {total}
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {slices.map((sl) => (
          <div key={sl.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: sl.color, flexShrink: 0 }} />
            <span>{sl.label}</span>
            <strong style={{ marginLeft: "auto" }}>{sl.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

type AnalyticsData = {
  summary: {
    totalCustomers: number;
    totalOrders: number;
    totalRevenue: number;
    totalErrors: number;
    rangeSignups: number;
    rangeLogins: number;
    rangeOrders: number;
    rangeRevenue: number;
    rangeErrors: number;
  };
  signups: { day: string; count: number }[];
  logins: { day: string; count: number }[];
  ordersByDay: { day: string; count: number; revenue: number }[];
  paymentBreakdown: { status: string; count: number }[];
  paymentMethods: { method: string; count: number; revenue: number }[];
  topPages: { productId: string; name: string; views: number }[];
  errorsByDay: { day: string; count: number }[];
  recentErrors: { id: string; kind: string; message: string; pageUrl: string; userAgent: string; createdAt: string }[];
};

const PRESETS: { label: string; from: string; to: string }[] = [
  { label: "Last 7 days", from: daysAgo(7), to: TODAY },
  { label: "Last 30 days", from: daysAgo(30), to: TODAY },
  { label: "Last 90 days", from: daysAgo(90), to: TODAY },
  { label: "All time", from: "2020-01-01", to: TODAY },
];

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PAID: C.teal,
  PENDING: C.gold,
  FAILED: C.red,
  REFUNDED: C.blue,
};

const METHOD_LABELS: Record<string, string> = {
  razorpay: "Razorpay",
  whatsapp_cod: "WhatsApp COD",
  manual: "Manual / Walk-in",
};

export default function AnalyticsDashboard() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(TODAY);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/analytics?from=${f}&to=${t}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed to load analytics");
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(from, to); }, [from, to, load]);

  const applyPreset = (p: typeof PRESETS[0]) => {
    setFrom(p.from);
    setTo(p.to);
  };

  if (error) {
    return (
      <div className="admin-card" style={{ color: C.red }}>
        <p>Failed to load analytics: {error}</p>
        <button className="btn-outline" onClick={() => load(from, to)}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
      {/* Date range controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className="btn-outline"
              style={{
                fontSize: 12,
                padding: "5px 12px",
                background: from === p.from && to === p.to ? C.olive : undefined,
                color: from === p.from && to === p.to ? C.ivory : undefined,
                borderColor: from === p.from && to === p.to ? C.olive : undefined,
              }}
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ padding: "5px 8px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12, background: "var(--ivory)" }}
          />
          <span style={{ color: C.sage }}>to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ padding: "5px 8px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12, background: "var(--ivory)" }}
          />
        </div>
      </div>

      {!data ? (
        <p style={{ color: C.sage, padding: 20 }}>Loading…</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="metric-grid">
            <div className="metric-card">
              <div className="label">Logins</div>
              <div className="value">{data.summary.rangeLogins}</div>
              <div className="metric-sub">{data.summary.totalCustomers} registered users</div>
            </div>
            <div className="metric-card">
              <div className="label">New Users</div>
              <div className="value">{data.summary.rangeSignups}</div>
            </div>
            <div className="metric-card">
              <div className="label">Orders</div>
              <div className="value">{data.summary.rangeOrders}</div>
              <div className="metric-sub">{formatINR(data.summary.rangeRevenue)} revenue</div>
            </div>
            <div className="metric-card">
              <div className="label">Errors Logged</div>
              <div className="value" style={{ color: data.summary.rangeErrors > 0 ? C.red : "inherit" }}>
                {data.summary.rangeErrors}
              </div>
            </div>
          </div>

          {/* Logins chart */}
          <div className="admin-card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 4 }}>User Logins</h3>
            <p style={{ fontSize: 12.5, color: "var(--sage)", marginBottom: 14 }}>
              Login attempts by day — successful sign-ins from customers.
            </p>
            <BarChart data={data.logins} color={C.teal} label="Login attempts by day" />
          </div>

          {/* Signups chart */}
          <div className="admin-card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 4 }}>New Registrations</h3>
            <p style={{ fontSize: 12.5, color: "var(--sage)", marginBottom: 14 }}>
              New customer accounts created by day.
            </p>
            <BarChart data={data.signups} color={C.olive} label="New signups by day" />
          </div>

          {/* Orders chart */}
          <div className="admin-card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 4 }}>Orders</h3>
            <p style={{ fontSize: 12.5, color: "var(--sage)", marginBottom: 14 }}>
              Orders placed by day, across all channels.
            </p>
            <BarChart data={data.ordersByDay} color={C.gold} label="Orders by day" />
          </div>

          {/* Payment health — two side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div className="admin-card">
              <h3 style={{ marginBottom: 12 }}>Payment Status</h3>
              <Donut
                slices={data.paymentBreakdown.map((p) => ({
                  label: p.status,
                  value: p.count,
                  color: PAYMENT_STATUS_COLORS[p.status] ?? C.sage,
                }))}
              />
            </div>
            <div className="admin-card">
              <h3 style={{ marginBottom: 12 }}>Payment Methods</h3>
              {data.paymentMethods.length === 0 ? (
                <p style={{ color: C.sage, fontSize: 13 }}>No paid orders in this range.</p>
              ) : (
                <table className="admin-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr><th>Method</th><th>Orders</th><th>Revenue</th></tr>
                  </thead>
                  <tbody>
                    {data.paymentMethods.map((m) => (
                      <tr key={m.method}>
                        <td>{METHOD_LABELS[m.method] ?? m.method}</td>
                        <td>{m.count}</td>
                        <td>{formatINR(m.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Top product pages */}
          <div className="admin-card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 4 }}>Most Viewed Products</h3>
            <p style={{ fontSize: 12.5, color: "var(--sage)", marginBottom: 14 }}>
              Product page views tracked in the database.
            </p>
            {data.topPages.length === 0 ? (
              <p style={{ color: C.sage, fontSize: 13 }}>No page views recorded in this range.</p>
            ) : (
              <HBar data={data.topPages} max={Math.max(...data.topPages.map((p) => p.views))} />
            )}
          </div>

          {/* Error tracking */}
          <div className="admin-card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 4 }}>Client-Side Errors</h3>
            <p style={{ fontSize: 12.5, color: "var(--sage)", marginBottom: 14 }}>
              JavaScript errors and unhandled rejections captured from user browsers.
            </p>
            <BarChart data={data.errorsByDay} color={C.red} height={140} label="JS errors by day" />
          </div>

          {/* Recent errors table */}
          {data.recentErrors.length > 0 && (
            <div className="admin-card" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 12 }}>Recent Errors</h3>
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table" style={{ fontSize: 12.5 }}>
                  <thead>
                    <tr><th>When</th><th>Type</th><th>Message</th><th>Page</th></tr>
                  </thead>
                  <tbody>
                    {data.recentErrors.map((e) => (
                      <tr key={e.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {new Date(e.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: e.kind === "js_error" ? "rgba(165,51,58,0.1)" : "rgba(42,100,150,0.1)",
                            color: e.kind === "js_error" ? C.red : C.blue,
                          }}>
                            {e.kind.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.message}>
                          {e.message}
                        </td>
                        <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.pageUrl}>
                          {e.pageUrl ? new URL(e.pageUrl, "https://x").pathname : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* GA4 note */}
          <div style={{ padding: "14px 18px", border: "1px dashed var(--line)", borderRadius: 10, marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: C.sage, margin: 0, lineHeight: 1.7 }}>
              <strong style={{ color: C.olive }}>GA4 Integration — coming soon.</strong>{" "}
              Session duration, page engagement time, bounce rates and traffic sources will appear here
              once the GA4 service account is connected. All the charts above run from our own database
              and work right now.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
