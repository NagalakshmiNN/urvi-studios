"use client";

import { useActionState, useRef, useEffect } from "react";
import { recordCapitalAction } from "@/app/actions/money";
import { PAYMENT_MODES } from "@/lib/money";

/** Today in local time — see the note in ExpenseForm. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CapitalForm({ contributors }: { contributors: string[] }) {
  const [state, formAction, pending] = useActionState(recordCapitalAction, undefined);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) form.current?.reset();
  }, [state?.success]);

  return (
    <form ref={form} action={formAction} className="admin-form-card money-form">
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="cap-date">Date</label>
          <input id="cap-date" type="date" name="contributedOn" defaultValue={today()} required />
        </div>
        <div className="form-group">
          <label htmlFor="cap-amount">Amount (₹)</label>
          <input
            id="cap-amount"
            type="text"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="50000"
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="cap-who">Who put it in</label>
          {/* A datalist rather than a dropdown: the two of you are almost
              always the answer, but a third person should not need a code
              change to be recordable. */}
          <input
            id="cap-who"
            type="text"
            name="contributor"
            list="known-contributors"
            autoComplete="off"
            placeholder="Lakshmi"
            required
          />
          <datalist id="known-contributors">
            {contributors.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="form-group">
          <label htmlFor="cap-mode">How it was paid in</label>
          <select id="cap-mode" name="mode" defaultValue="UPI" required>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="cap-ref">Reference</label>
          <input id="cap-ref" type="text" name="reference" placeholder="UPI ref" autoComplete="off" />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="cap-notes">Note</label>
        <input id="cap-notes" type="text" name="notes" placeholder="Business start-up capital" autoComplete="off" />
      </div>

      {state?.error && <div className="form-error">{state.error}</div>}
      {state?.success && <div className="form-success">{state.success}</div>}

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Record this contribution"}
      </button>
    </form>
  );
}
