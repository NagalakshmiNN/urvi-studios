"use client";

// Which months the report covers.
//
// Two dates and three shortcuts. The shortcuts exist because the three periods
// anybody actually asks for — this financial year, last financial year, this
// quarter — are otherwise four date fields to get right, and getting one wrong
// produces a report that looks perfectly reasonable and covers the wrong
// twelve months.

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/** The Indian financial year containing a date: April to March. */
function financialYear(offset = 0): { from: string; to: string } {
  const now = new Date();
  const start = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) + offset;
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

/** The quarter containing today, on the Indian financial calendar. */
function thisQuarter(): { from: string; to: string } {
  const now = new Date();
  // Financial quarters start in April, July, October and January.
  const month = now.getMonth(); // 0-11
  const startMonth = Math.floor(((month + 9) % 12) / 3) * 3; // 0,3,6,9 offset from April
  const aprilYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const start = new Date(aprilYear, 3 + startMonth, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(start), to: iso(end) };
}

export default function PeriodPicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);

  function go(next: { from: string; to: string }) {
    const q = new URLSearchParams(params.toString());
    q.set("from", next.from);
    q.set("to", next.to);
    router.push(`/admin/reports?${q.toString()}`);
  }

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="form-group" style={{ margin: 0 }}>
        <label style={{ fontSize: 12.5 }}>From</label>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label style={{ fontSize: 12.5 }}>To</label>
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <button
        type="button"
        className="btn btn-outline"
        disabled={!start || !end || start > end}
        onClick={() => go({ from: start, to: end })}
      >
        Show
      </button>

      <span style={{ width: 1, alignSelf: "stretch", background: "rgba(0,0,0,0.08)", margin: "0 4px" }} />

      <button type="button" className="btn btn-outline btn-small" onClick={() => go(financialYear(0))}>
        This financial year
      </button>
      <button type="button" className="btn btn-outline btn-small" onClick={() => go(financialYear(-1))}>
        Last financial year
      </button>
      <button type="button" className="btn btn-outline btn-small" onClick={() => go(thisQuarter())}>
        This quarter
      </button>
    </div>
  );
}
