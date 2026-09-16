// Where the money went — one bar per stream, drawn to a shared scale.
//
// Hand-drawn SVG rather than a charting library, same reasoning as the revenue
// chart: this is a handful of bars on a server-rendered page, and a library
// would mean shipping JavaScript to draw something the server already knows.
//
// Colour carries no meaning on its own here — every bar is labelled with its
// name and its amount — but money in and money out are deliberately far apart
// in hue so the shape of the page reads before any of the words do. The pair
// was checked for lightness, chroma, contrast against the ivory ground, and
// separation under protanopia and tritanopia.

import { formatPaise } from "@/lib/money";

const IN = "#00806B";
const STOCK = "#A98238";
const OUT = "#a5333a";

export type FlowRow = { label: string; paise: number; kind: "in" | "stock" | "out"; note?: string };

const FILL = { in: IN, stock: STOCK, out: OUT } as const;

export default function MoneyFlow({ rows }: { rows: FlowRow[] }) {
  const peak = Math.max(...rows.map((r) => Math.abs(r.paise)), 1);

  return (
    <div className="flow-chart">
      {rows.map((r) => {
        const width = (Math.abs(r.paise) / peak) * 100;
        return (
          <div className="flow-row" key={r.label}>
            <div className="flow-label">
              <span>{r.label}</span>
              {r.note && <em>{r.note}</em>}
            </div>
            <div className="flow-track">
              {/* A hairline for a zero amount, so the row still reads as a
                  row rather than looking like a rendering failure. */}
              <span
                className="flow-bar"
                style={{ width: `${Math.max(width, 0.4)}%`, background: FILL[r.kind] }}
                aria-hidden="true"
              />
            </div>
            <div className="flow-amount">{formatPaise(r.paise)}</div>
          </div>
        );
      })}
    </div>
  );
}
