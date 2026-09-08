"use client";

import { useActionState, useState } from "react";
import { createManualOrderAction } from "@/app/actions/admin";
import { formatINR } from "@/lib/format";
import { MANUAL_SOURCES, PAYMENT_MODES } from "@/lib/order-channels";

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  sizes: { label: string; stock: number }[];
  colors: { name: string }[];
};

type Row = { key: number; productId: string };

let rowKeySeq = 1;

export default function ManualOrderForm({ products }: { products: Product[] }) {
  const [state, formAction, pending] = useActionState(createManualOrderAction, undefined);
  const [rows, setRows] = useState<Row[]>([{ key: rowKeySeq++, productId: "" }]);
  const byId = new Map(products.map((p) => [p.id, p]));
  // Someone standing in front of you is the common case, so it leads.
  const [source, setSource] = useState("walk_in");
  const [fulfilment, setFulfilment] = useState<"delivery" | "pickup">("pickup");
  const [paid, setPaid] = useState(true);

  // A walk-in is always handed over there and then; anything phoned or
  // messaged in still needs delivering unless told otherwise.
  function chooseSource(next: string) {
    setSource(next);
    setFulfilment(next === "walk_in" ? "pickup" : "delivery");
  }

  const runningTotal = rows.reduce((sum, row) => {
    const product = byId.get(row.productId);
    return product ? sum + product.price : sum;
  }, 0);

  function addRow() {
    setRows((r) => [...r, { key: rowKeySeq++, productId: "" }]);
  }
  function removeRow(key: number) {
    setRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r));
  }
  function setRowProduct(key: number, productId: string) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, productId } : row)));
  }

  return (
    <form action={formAction}>
      {state?.error && <div className="notice-box error">{state.error}</div>}
      {state?.success && <div className="notice-box">{state.success}</div>}

      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label>How did this order come in?</label>
          <select name="source" value={source} onChange={(e) => chooseSource(e.target.value)}>
            {MANUAL_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 2 }}>
          <label>How does it reach them?</label>
          <select
            name="fulfilmentMethod"
            value={fulfilment}
            onChange={(e) => setFulfilment(e.target.value as "delivery" | "pickup")}
          >
            <option value="pickup">Collected in person</option>
            <option value="delivery">To be delivered</option>
          </select>
        </div>
      </div>
      {source === "walk_in" && fulfilment === "pickup" && (
        <p className="field-hint" style={{ marginTop: -8 }}>
          This records a completed sale: stock comes out straight away and the order is marked collected.
        </p>
      )}

      <h3 style={{ margin: "22px 0 12px" }}>Items</h3>
      {rows.map((row) => {
        const product = byId.get(row.productId);
        return (
          <div key={row.key} className="form-row" style={{ alignItems: "flex-end" }}>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Product</label>
              <select
                name="lineProductId"
                value={row.productId}
                onChange={(e) => setRowProduct(row.key, e.target.value)}
              >
                <option value="">Choose a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                    {p.name} — {formatINR(p.price)} ({p.stock} left)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Size</label>
              <select name="lineSize" defaultValue="">
                <option value="">—</option>
                {(product?.sizes ?? []).map((s) => (
                  <option key={s.label} value={s.label} disabled={s.stock <= 0}>
                    {s.label} ({s.stock} left)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Color</label>
              <select name="lineColor" defaultValue="">
                <option value="">—</option>
                {(product?.colors ?? []).map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ maxWidth: 80 }}>
              <label>Qty</label>
              <input type="number" name="lineQty" min={1} defaultValue={1} />
            </div>
            <div className="form-group" style={{ maxWidth: 80 }}>
              <button type="button" className="link-btn danger" onClick={() => removeRow(row.key)} style={{ marginBottom: 12 }}>
                Remove
              </button>
            </div>
          </div>
        );
      })}
      <button type="button" className="btn btn-outline btn-small" onClick={addRow} style={{ marginBottom: 24 }}>
        + Add Item
      </button>

      <h3 style={{ margin: "6px 0 12px" }}>Customer</h3>
      <div className="form-row">
        <div className="form-group">
          <label>Name</label>
          <input type="text" name="customerName" required />
        </div>
        <div className="form-group">
          <label>Phone</label>
          <input type="tel" name="customerPhone" required />
        </div>
        <div className="form-group">
          <label>Email (optional)</label>
          <input type="email" name="customerEmail" />
        </div>
      </div>
      {/* Nothing is being posted to a collected-in-person sale, so the
          address fields only appear when they'd actually be used. */}
      {fulfilment === "delivery" && (
        <>
          <div className="form-group">
            <label>Address (optional — fill in what you have)</label>
            <input type="text" name="addressLine1" placeholder="House no, street, area" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input type="text" name="city" />
            </div>
            <div className="form-group">
              <label>State</label>
              <input type="text" name="state" />
            </div>
            <div className="form-group">
              <label>Pincode</label>
              <input type="text" name="pincode" maxLength={6} />
            </div>
          </div>
        </>
      )}

      <h3 style={{ margin: "22px 0 12px" }}>Payment</h3>
      <div className="form-row">
        <div className="form-group">
          <label>Settled?</label>
          <select name="paymentStatus" value={paid ? "PAID" : "PENDING"} onChange={(e) => setPaid(e.target.value === "PAID")}>
            <option value="PAID">Already paid / collected</option>
            <option value="PENDING">Not paid yet</option>
          </select>
        </div>
        {paid && (
          <div className="form-group">
            <label>Paid by</label>
            <select name="paymentMode" defaultValue="cash">
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="form-group">
          <label>Order value</label>
          <input type="text" value={runningTotal > 0 ? `${formatINR(runningTotal)} (before quantities)` : "—"} readOnly disabled />
        </div>
      </div>
      {paid && (
        <p className="field-hint" style={{ marginTop: -8 }}>
          Recording cash, UPI and card separately is what lets you reconcile cash in hand at the end of a day.
        </p>
      )}
      <div className="form-group">
        <label>Notes (optional)</label>
        <textarea name="notes" rows={2} placeholder="Anything worth remembering about this order" />
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Record Order"}
      </button>
      <p className="field-hint">This reserves stock immediately, the same as a confirmed online order — use it for sales that already happened, not ones you're still negotiating.</p>
    </form>
  );
}
