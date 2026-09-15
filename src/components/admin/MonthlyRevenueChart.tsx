// Month-by-month revenue and profit, every channel together.
//
// Hand-drawn SVG rather than a charting library: this is two series of twelve
// bars on a server-rendered page, and a library would mean shipping JavaScript
// to the browser to draw something the server already knows.
//
// Colour: the brand olive fails as a data fill — too dark and too close to
// grey to read as a mark — so the pair here is a deep teal-green against the
// brand gold. Both were checked for lightness, chroma, contrast against the
// ivory surface, and separation under protanopia and tritanopia. Identity is
// never carried by colour alone: there is a legend, the latest month is
// labelled outright, and the full numbers sit in a table below.

import { formatINR } from "@/lib/format";
import type { MonthStats } from "@/lib/monthly-performance";

const REVENUE = "#00806B";
const PROFIT = "#A98238";
const LOSS = "#a5333a";

export default function MonthlyRevenueChart({ months }: { months: MonthStats[] }) {
  const hasAnySale = months.some((m) => m.orders > 0);

  if (!hasAnySale) {
    return (
      <div className="chart-card">
        <div className="chart-head">
          <h3>Revenue &amp; profit by month</h3>
          <p className="chart-sub">Website, walk-in, WhatsApp and phone sales together.</p>
        </div>
        <div className="chart-empty">
          <p>No sales recorded yet — this fills in as orders come through.</p>
          <p className="chart-empty-note">
            Every channel counts here: a website checkout and a piece handed over at your door are both sales.
          </p>
        </div>
      </div>
    );
  }

  // One scale for both series, because both are rupees. Two y-axes would let
  // the eye compare heights that aren't comparable.
  const peak = Math.max(...months.flatMap((m) => [m.revenue, m.profit]), 0);
  const trough = Math.min(...months.map((m) => m.profit), 0);
  const span = peak - trough || 1;

  const W = 720;
  const H = 260;
  const PAD = { top: 22, right: 12, bottom: 34, left: 62 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const y = (value: number) => PAD.top + ((peak - value) / span) * plotH;
  const zeroY = y(0);

  const slot = plotW / months.length;
  // 2px between the pair, and the group narrower than its slot so months read
  // as groups rather than one continuous run of bars.
  const barW = Math.max(4, Math.min(18, (slot - 10) / 2 - 1));

  // Four gridlines is enough to read a value off; more turns into hatching.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(trough + span * f));
  const latest = months[months.length - 1];

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>Revenue &amp; profit by month</h3>
        <p className="chart-sub">Website, walk-in, WhatsApp and phone sales together.</p>
        <div className="chart-legend">
          <span><i style={{ background: REVENUE }} aria-hidden="true" />Revenue</span>
          <span><i style={{ background: PROFIT }} aria-hidden="true" />Profit</span>
        </div>
      </div>

      <div className="chart-scroll">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="chart-svg"
          role="img"
          aria-label={`Revenue and profit for the last ${months.length} months. Latest month ${latest.label}: revenue ${formatINR(latest.revenue)}, profit ${formatINR(latest.profit)}.`}
        >
          {/* Grid and value axis, kept faint so the bars stay the subject. */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="rgba(63,72,39,0.13)" strokeWidth="1" />
              <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end" className="chart-axis-text">
                {t === 0 ? "0" : `${Math.round(t / 1000)}k`}
              </text>
            </g>
          ))}
          {/* The zero line is drawn solid — with a loss-making month it is the
              thing the eye needs to find first. */}
          <line x1={PAD.left} x2={W - PAD.right} y1={zeroY} y2={zeroY} stroke="rgba(63,72,39,0.4)" strokeWidth="1" />

          {months.map((m, i) => {
            const groupX = PAD.left + i * slot + slot / 2;
            const revX = groupX - barW - 1;
            const proX = groupX + 1;
            const revTop = y(Math.max(m.revenue, 0));
            const proTop = y(Math.max(m.profit, 0));
            const proBottom = y(Math.min(m.profit, 0));
            const isLatest = i === months.length - 1;

            return (
              <g key={m.key}>
                {m.revenue > 0 && (
                  <rect x={revX} y={revTop} width={barW} height={Math.max(1, zeroY - revTop)} rx="3" fill={REVENUE}>
                    <title>{`${m.label} — revenue ${formatINR(m.revenue)} from ${m.orders} order${m.orders === 1 ? "" : "s"}`}</title>
                  </rect>
                )}
                {m.profit !== 0 && (
                  <rect
                    x={proX}
                    y={m.profit >= 0 ? proTop : zeroY}
                    width={barW}
                    height={Math.max(1, m.profit >= 0 ? zeroY - proTop : proBottom - zeroY)}
                    rx="3"
                    fill={m.profit >= 0 ? PROFIT : LOSS}
                  >
                    <title>
                      {`${m.label} — ${m.profit >= 0 ? "profit" : "loss"} ${formatINR(Math.abs(m.profit))}${
                        m.costComplete ? "" : " (some costs not recorded, so this is optimistic)"
                      }`}
                    </title>
                  </rect>
                )}
                <text x={groupX} y={H - 12} textAnchor="middle" className="chart-axis-text">
                  {m.label}
                </text>
                {/* Only the latest month is labelled outright. A number over
                    every bar is noise; the rest are one hover away, and all of
                    them are in the table. */}
                {isLatest && m.revenue > 0 && (
                  <text x={groupX} y={Math.min(revTop, proTop) - 7} textAnchor="middle" className="chart-value-text">
                    {formatINR(m.revenue)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {months.some((m) => m.orders > 0 && !m.costComplete) && (
        <p className="chart-note">
          Some sold pieces have no landed cost recorded, so profit for those months is flattering. Fill in Landed Cost
          on the Products screen and it corrects itself.
        </p>
      )}

      <details className="chart-table">
        <summary>See the numbers</summary>
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr><th>Month</th><th>Orders</th><th>Revenue</th><th>Cost of goods</th><th>Profit</th></tr>
            </thead>
            <tbody>
              {months.filter((m) => m.orders > 0).map((m) => (
                <tr key={m.key}>
                  <td>{m.label}</td>
                  <td>{m.orders}</td>
                  <td>{formatINR(m.revenue)}</td>
                  <td>{m.cost > 0 ? formatINR(m.cost) : "—"}</td>
                  <td style={{ color: m.profit < 0 ? LOSS : "inherit", fontWeight: 600 }}>{formatINR(m.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
