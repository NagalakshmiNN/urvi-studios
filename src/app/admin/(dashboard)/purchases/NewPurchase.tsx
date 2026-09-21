"use client";

import { useActionState } from "react";
import Link from "next/link";
import { previewPurchaseAction, savePurchaseAction, type PurchaseFormState } from "@/app/actions/purchases";
import type { PurchasePlan } from "@/lib/record-purchase";

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const EXAMPLE = `{
  "vendor": { "name": "G.D. Fabrics", "city": "Jaipur", "state": "Rajasthan", "gstin": "08ABXPA3166H1ZF", "type": "Manufacturer" },
  "invoice": { "number": "GD707", "date": "2026-09-07", "freight": 500, "discount": 1078.14, "paymentMode": "UPI" },
  "totals": { "gross": 45300, "taxable": 44221.86, "gst": 2211.09, "grandTotal": 46432.95 },
  "lines": [
    { "item": "Short Kurthi", "colour": "Red", "size": "S", "qty": 1, "unitPrice": 212.50, "gstRatePct": 5, "category": "Casual Wear", "fabric": "Cotton" }
  ]
}`;

export default function NewPurchase() {
  const [state, preview, checking] = useActionState<PurchaseFormState | undefined, FormData>(previewPurchaseAction, undefined);
  const [saveState, save, saving] = useActionState<PurchaseFormState | undefined, FormData>(savePurchaseAction, undefined);

  const saved = saveState?.stage === "saved" ? saveState.result : null;
  const shown = saveState?.stage === "errors" ? saveState : state;
  const raw = (shown && "raw" in shown ? shown.raw : "") || "";

  if (saved) {
    return (
      <div className="admin-card">
        <h3 style={{ marginBottom: 10 }}>Recorded as {saved.ref}</h3>
        <p style={{ fontSize: 14, color: "var(--sage)", lineHeight: 1.7 }}>
          {saved.piecesReceived} piece{saved.piecesReceived === 1 ? "" : "s"} received.{" "}
          {saved.productsCreated > 0 && (
            <>
              {saved.productsCreated} new product{saved.productsCreated === 1 ? "" : "s"} created — they are{" "}
              <strong>switched off</strong> until you add photographs.{" "}
            </>
          )}
          {saved.productsUpdated > 0 && <>{saved.productsUpdated} existing product{saved.productsUpdated === 1 ? "" : "s"} restocked. </>}
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <Link href={`/admin/purchases/${saved.purchaseId}`} className="btn btn-primary">View the purchase</Link>
          <Link href="/admin/products" className="btn btn-outline">Go to Products</Link>
          <Link href="/admin/purchases/new" className="btn btn-outline">Enter another</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="admin-card" style={{ marginBottom: 28 }}>
        <form action={preview}>
          <div className="form-group">
            <label htmlFor="brief">Invoice block</label>
            <textarea
              id="brief"
              name="brief"
              rows={14}
              defaultValue={raw}
              placeholder={EXAMPLE}
              spellCheck={false}
              style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5, lineHeight: 1.6 }}
            />
            <span className="field-hint">
              Send the invoice — a PDF or a photo — to Claude and paste back the block it gives you. Nothing is saved until
              you have read the summary below.
            </span>
          </div>
          <button type="submit" className="btn btn-outline" disabled={checking}>
            {checking ? "Reading…" : "Check it"}
          </button>
        </form>

        {shown?.stage === "errors" && (
          <div className="notice-box" style={{ borderColor: "#a5333a", marginTop: 18 }}>
            <strong>This can&apos;t be saved yet.</strong>
            <ul style={{ margin: "10px 0 0 18px", padding: 0, fontSize: 13.5, lineHeight: 1.7 }}>
              {shown.errors.map((e) => (
                <li key={e} style={{ whiteSpace: "pre-wrap" }}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {state?.stage === "review" && <Review plan={state.plan} warnings={state.warnings} raw={state.raw} save={save} saving={saving} />}
    </>
  );
}

function Review({
  plan,
  warnings,
  raw,
  save,
  saving,
}: {
  plan: PurchasePlan;
  warnings: string[];
  raw: string;
  save: (formData: FormData) => void;
  saving: boolean;
}) {
  const blocked = plan.problems.length > 0;
  const newProducts = plan.products.filter((p) => !p.existing).length;

  return (
    <>
      <div className="admin-card" style={{ marginBottom: 28 }}>
        <h3 style={{ marginBottom: 14 }}>What this invoice costs</h3>
        <div className="table-scroll">
          <table className="admin-table">
            <tbody>
              <Row label="Gross" value={rupees(plan.costed.grossPaise)} />
              {plan.costed.discountPaise > 0 && <Row label="Less discount" value={`− ${rupees(plan.costed.discountPaise)}`} />}
              <Row label="Taxable" value={rupees(plan.costed.taxablePaise)} />
              <Row label="GST" value={rupees(plan.costed.gstPaise)} />
              <Row label="Invoice total" value={rupees(plan.costed.invoiceTotalPaise)} strong />
              {plan.costed.freightPaise > 0 && <Row label="Freight" value={rupees(plan.costed.freightPaise)} />}
              {plan.costed.otherChargesPaise > 0 && <Row label="Other charges" value={rupees(plan.costed.otherChargesPaise)} />}
              <Row label={`Landed cost of ${plan.costed.totalQty} pieces`} value={rupees(plan.costed.landedTotalPaise)} strong />
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--sage)", marginTop: 14, lineHeight: 1.7 }}>
          Freight is split evenly per piece; the discount is split by what each line is worth. Both come to exactly their
          totals — nothing is lost to rounding.
        </p>
      </div>

      {warnings.length > 0 && (
        <div className="notice-box" style={{ marginBottom: 28 }}>
          <strong>Worth a look before you save.</strong>
          <ul style={{ margin: "10px 0 0 18px", padding: 0, fontSize: 13.5, lineHeight: 1.7 }}>
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}

      {blocked && (
        <div className="notice-box" style={{ borderColor: "#a5333a", marginBottom: 28 }}>
          <strong>Fix these first.</strong>
          <ul style={{ margin: "10px 0 0 18px", padding: 0, fontSize: 13.5, lineHeight: 1.7 }}>
            {plan.problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
      )}

      <div className="admin-card" style={{ marginBottom: 28 }}>
        <h3 style={{ marginBottom: 6 }}>
          {plan.products.length} product{plan.products.length === 1 ? "" : "s"}
          {newProducts > 0 && <span style={{ color: "var(--sage)", fontSize: 14, fontWeight: 400 }}> · {newProducts} new</span>}
        </h3>
        <p style={{ fontSize: 12.5, color: "var(--sage)", margin: "0 0 18px", lineHeight: 1.7 }}>
          A new product arrives switched off, with no photographs, priced from its markup band. An existing one is
          restocked and its landed cost updated — its price is left alone, and any change the band suggests is offered on
          the Pricing screen instead.
        </p>

        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Sizes received</th>
                <th style={{ textAlign: "right" }}>Landed / piece</th>
                <th style={{ textAlign: "right" }}>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {plan.products.map((p) => (
                <tr key={p.key}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    {p.category && <div style={{ fontSize: 12, color: "var(--sage)" }}>{p.category.name}</div>}
                    {p.problems.map((m) => (
                      <div key={m} style={{ fontSize: 12, color: "#a5333a", marginTop: 3 }}>{m}</div>
                    ))}
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {p.sizes.map((s) => (
                      <span key={s.label} style={{ display: "inline-block", marginRight: 10, whiteSpace: "nowrap" }}>
                        <strong>{s.label}</strong> +{s.received}
                        {s.stockBefore != null && <span style={{ color: "var(--sage)" }}> ({s.stockBefore}→{s.stockAfter})</span>}
                      </span>
                    ))}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    ₹{p.landedCostRupees.toLocaleString("en-IN")}
                    {p.landedCostBefore != null && p.landedCostBefore !== p.landedCostRupees && (
                      <div style={{ fontSize: 11.5, color: "var(--sage)" }}>was ₹{p.landedCostBefore.toLocaleString("en-IN")}</div>
                    )}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {p.priceAfter != null ? `₹${p.priceAfter.toLocaleString("en-IN")}` : "—"}
                    {p.existing && p.suggested && p.suggested.price !== p.existing.price && (
                      <div style={{ fontSize: 11.5, color: "var(--sage)" }}>band says ₹{p.suggested.price.toLocaleString("en-IN")}</div>
                    )}
                  </td>
                  <td style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                    {p.existing ? <span style={{ color: "var(--sage)" }}>Restock</span> : <strong>New · off</strong>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 28 }}>
        <h3 style={{ marginBottom: 10 }}>{plan.vendor.isNew ? "New vendor" : "Vendor"}</h3>
        <p style={{ fontSize: 14 }}>
          {plan.vendor.name} <span style={{ color: "var(--sage)" }}>· {plan.vendor.code}</span>
          {plan.vendor.isNew && <span style={{ color: "var(--sage)" }}> — will be created</span>}
        </p>

        <h3 style={{ margin: "22px 0 10px" }}>Recorded as paid</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8 }}>
          {plan.expenses.map((e) => (
            <li key={e.category + e.description}>
              <strong>{e.category}</strong> — {rupees(e.amountPaise)} <span style={{ color: "var(--sage)" }}>({e.description})</span>
            </li>
          ))}
        </ul>
        <p style={{ fontSize: 12.5, color: "var(--sage)", marginTop: 12, lineHeight: 1.7 }}>
          Stock purchases are money turned into stock, not money spent — the Money Map keeps them apart from running costs.
        </p>
      </div>

      <div className="admin-card">
        <form
          action={save}
          onSubmit={(e) => {
            if (!confirm(`Record this purchase? ${plan.costed.totalQty} pieces, ${rupees(plan.costed.landedTotalPaise)} landed.`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="brief" value={raw} />
          <button type="submit" className="btn btn-primary" disabled={saving || blocked}>
            {saving ? "Recording…" : "Record this purchase"}
          </button>
          {blocked && <span className="field-hint" style={{ display: "block", marginTop: 8 }}>Fix the problems above first.</span>}
        </form>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr>
      <td style={{ fontWeight: strong ? 600 : 400 }}>{label}</td>
      <td style={{ textAlign: "right", fontWeight: strong ? 600 : 400, whiteSpace: "nowrap" }}>{value}</td>
    </tr>
  );
}
