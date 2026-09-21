"use client";

import { useActionState, useState } from "react";
import { saveBandsAction, applyPricingAction, type PricingFormState } from "@/app/actions/purchases";
import type { MarkupBand } from "@/lib/markup-bands";

export type BandRow = MarkupBand & {
  label: string;
  products: number;
  medianMarkupPct: number | null;
  wouldChange: number;
};

/**
 * The four bands, each shown next to what the catalogue is already doing in it.
 *
 * That pairing is the point of the screen. Asking for four markup percentages
 * out of the air is a hard question; showing that thirty-one products under
 * ₹500 are currently selling at a median of 96% over cost makes it an easy one.
 */
export default function PricingControls({ rows }: { rows: BandRow[] }) {
  const [bands, setBands] = useState(rows);
  const [saveState, save, saving] = useActionState<PricingFormState, FormData>(saveBandsAction, undefined);
  const [applyState, apply, applying] = useActionState<PricingFormState, FormData>(applyPricingAction, undefined);

  const totalWouldChange = bands.reduce((a, b) => a + b.wouldChange, 0);

  function set(i: number, patch: Partial<BandRow>) {
    setBands((current) => current.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }

  return (
    <>
      <div className="admin-card" style={{ marginBottom: 28 }}>
        <form action={save}>
          <input type="hidden" name="bandCount" value={bands.length} />

          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Landed cost per piece</th>
                  <th style={{ textAlign: "right" }}>Target markup</th>
                  <th style={{ textAlign: "right" }}>Minimum markup</th>
                  <th style={{ textAlign: "right" }}>Products</th>
                  <th style={{ textAlign: "right" }}>Charging now</th>
                </tr>
              </thead>
              <tbody>
                {bands.map((band, i) => {
                  const last = i === bands.length - 1;
                  const from = i === 0 ? 0 : (bands[i - 1].upToPaise ?? 0) / 100;
                  return (
                    <tr key={i}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span style={{ color: "var(--sage)" }}>₹{from.toLocaleString("en-IN")} –</span>{" "}
                        {last ? (
                          <>
                            <span>and above</span>
                            <input type="hidden" name={`upTo_${i}`} value="" />
                          </>
                        ) : (
                          <input
                            id={`upTo_${i}`}
                            name={`upTo_${i}`}
                            type="number"
                            min={1}
                            step={1}
                            value={band.upToPaise == null ? "" : band.upToPaise / 100}
                            onChange={(e) => set(i, { upToPaise: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })}
                            aria-label={`Top of band ${i + 1}, in rupees`}
                            style={{ width: 96 }}
                          />
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          id={`target_${i}`}
                          name={`target_${i}`}
                          type="number"
                          min={0}
                          max={1000}
                          step={1}
                          value={band.targetPct}
                          onChange={(e) => set(i, { targetPct: Number(e.target.value) })}
                          aria-label={`Target markup for band ${i + 1}, percent`}
                          style={{ width: 80, textAlign: "right" }}
                        />{" "}
                        %
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          id={`min_${i}`}
                          name={`min_${i}`}
                          type="number"
                          min={0}
                          max={1000}
                          step={1}
                          value={band.minPct}
                          onChange={(e) => set(i, { minPct: Number(e.target.value) })}
                          aria-label={`Minimum markup for band ${i + 1}, percent`}
                          style={{ width: 80, textAlign: "right" }}
                        />{" "}
                        %
                      </td>
                      <td style={{ textAlign: "right" }}>{band.products}</td>
                      <td style={{ textAlign: "right", color: "var(--sage)", whiteSpace: "nowrap" }}>
                        {band.medianMarkupPct == null ? "—" : `${band.medianMarkupPct}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="field-hint" style={{ marginTop: 14, lineHeight: 1.7 }}>
            <strong>Charging now</strong> is the middle of what those products actually sell at today, over their landed
            cost. <strong>Minimum markup</strong> is the discount floor — the lowest a piece may go for and still be
            worth having bought.
          </p>

          {saveState?.error && <div className="form-error">{saveState.error}</div>}
          {saveState?.errors && (
            <div className="form-error">
              <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                {saveState.errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}
          {saveState?.success && <div className="form-success">{saveState.success}</div>}

          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 16 }}>
            {saving ? "Saving…" : "Save bands"}
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 8 }}>Apply to the catalogue</h3>
        <p style={{ fontSize: 13.5, color: "var(--sage)", lineHeight: 1.7, marginBottom: 16 }}>
          Saving a band changes nothing on its own. Prices only move when you say so — because deciding what a markup
          should be and moving two hundred live prices are two different decisions.{" "}
          {totalWouldChange > 0 ? (
            <>
              As things stand, <strong style={{ color: "var(--ink, inherit)" }}>{totalWouldChange}</strong> price
              {totalWouldChange === 1 ? "" : "s"} would move.
            </>
          ) : (
            <>Every priced product already matches its band.</>
          )}{" "}
          Products with no recorded landed cost are never touched.
        </p>

        <form
          action={apply}
          onSubmit={(e) => {
            if (!confirm(`Re-price ${totalWouldChange} product${totalWouldChange === 1 ? "" : "s"} from the bands? This changes what customers see.`)) {
              e.preventDefault();
            }
          }}
        >
          <button type="submit" className="btn btn-outline" disabled={applying || totalWouldChange === 0}>
            {applying ? "Re-pricing…" : "Apply to catalogue"}
          </button>
          {applyState?.error && <div className="form-error">{applyState.error}</div>}
          {applyState?.success && <div className="form-success">{applyState.success}</div>}
        </form>
      </div>
    </>
  );
}
