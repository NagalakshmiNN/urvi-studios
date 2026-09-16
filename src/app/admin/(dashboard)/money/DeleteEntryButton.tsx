"use client";

import { useActionState } from "react";
import { useState } from "react";
import { deleteCapitalAction, deleteExpenseAction, type MoneyFormState } from "@/app/actions/money";

// Same two-step confirmation as deleting a product: an inline "are you sure"
// in the row, then the native dialog. A ledger entry removed by a stray click
// is a number that silently stops adding up.
export default function DeleteEntryButton({
  id,
  what,
  kind,
}: {
  id: string;
  /** Named in the confirmation, so it's obvious which row is going. */
  what: string;
  kind: "capital" | "expense";
}) {
  const action = kind === "capital" ? deleteCapitalAction : deleteExpenseAction;
  const [state, formAction, pending] = useActionState<MoneyFormState, FormData>(action, undefined);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className="link-btn danger" onClick={() => setConfirming(true)}>
        Remove
      </button>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Remove "${what}" from the ledger? This can't be undone.`)) e.preventDefault();
      }}
      style={{ display: "flex", gap: 10, alignItems: "center" }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="link-btn danger" disabled={pending}>
        {pending ? "Removing…" : "Yes, remove"}
      </button>
      <button type="button" className="link-btn" disabled={pending} onClick={() => setConfirming(false)}>
        Cancel
      </button>
      {state?.error && <span style={{ color: "#a5333a", fontSize: 11.5 }}>{state.error}</span>}
    </form>
  );
}
