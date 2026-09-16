"use client";

import { useActionState, useRef, useEffect } from "react";
import { recordExpenseAction } from "@/app/actions/money";
import { EXPENSE_CATEGORIES, PAYMENT_MODES, GST_RATES, STOCK_PURCHASE } from "@/lib/money";

/** Today as YYYY-MM-DD in local time — not toISOString(), which is UTC and so
 *  shows yesterday's date for anyone recording a spend after 5:30am IST. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ExpenseForm() {
  const [state, formAction, pending] = useActionState(recordExpenseAction, undefined);
  const form = useRef<HTMLFormElement>(null);

  // Clear the form after a successful save, so the next one starts fresh
  // instead of leaving the last entry sitting there looking unsaved.
  useEffect(() => {
    if (state?.success) form.current?.reset();
  }, [state?.success]);

  return (
    <form ref={form} action={formAction} className="admin-form-card money-form">
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="exp-date">Date</label>
          <input id="exp-date" type="date" name="spentOn" defaultValue={today()} required />
        </div>
        <div className="form-group">
          <label htmlFor="exp-amount">Amount paid (₹)</label>
          <input
            id="exp-amount"
            type="text"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="580"
            required
          />
          <span className="field-hint">The total on the receipt, GST included.</span>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group" style={{ flex: 1.2 }}>
          <label htmlFor="exp-category">What kind of spend</label>
          <select id="exp-category" name="category" defaultValue="" required>
            <option value="" disabled>Choose one</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="field-hint">
            <strong>{STOCK_PURCHASE}</strong> is money paid to a vendor for pieces to sell — it becomes stock rather
            than a cost. Everything else is a running cost.
          </span>
        </div>
        <div className="form-group">
          <label htmlFor="exp-gst">GST on it</label>
          <select id="exp-gst" name="gstRateBp" defaultValue="">
            <option value="">Not sure</option>
            {GST_RATES.map((g) => (
              <option key={g.bp} value={g.bp}>{g.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="exp-description">What was it for</label>
        <input
          id="exp-description"
          type="text"
          name="description"
          placeholder="Branded poly-mailers"
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="exp-payee">Paid to</label>
          <input id="exp-payee" type="text" name="payee" placeholder="Amazon" autoComplete="off" />
        </div>
        <div className="form-group">
          <label htmlFor="exp-mode">How it was paid</label>
          <select id="exp-mode" name="paymentMode" defaultValue="UPI" required>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="exp-ref">Reference</label>
          <input id="exp-ref" type="text" name="reference" placeholder="Invoice or UPI ref" autoComplete="off" />
        </div>
      </div>

      {state?.error && <div className="form-error">{state.error}</div>}
      {state?.success && <div className="form-success">{state.success}</div>}

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Record this spend"}
      </button>
    </form>
  );
}
