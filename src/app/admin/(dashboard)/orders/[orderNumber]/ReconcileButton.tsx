"use client";

// "Did this order actually get paid?" — answered by Razorpay, not by us.
//
// Shown on any order that reached Razorpay but is not yet marked paid. That
// is precisely the state where the shop owner cannot tell, from anything on
// this screen, whether a customer's money has left their account: the order
// says PENDING either because nobody paid, or because the news never reached
// us. Those two need opposite responses, and guessing wrong means either
// chasing a customer who owes nothing or ignoring one who has paid.

import { useState, useTransition } from "react";
import { reconcileWithRazorpayAction } from "@/app/actions/admin";

export default function ReconcileButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        className="btn-outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            const r = await reconcileWithRazorpayAction(orderId);
            setResult({ ok: r.ok, message: r.message });
          })
        }
        style={{ fontSize: 13, padding: "7px 14px" }}
      >
        {pending ? "Asking Razorpay…" : "Check with Razorpay"}
      </button>

      {result && (
        <p
          role="status"
          style={{
            marginTop: 10,
            fontSize: 13,
            lineHeight: 1.7,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--line, #e2e0d8)",
            background: result.ok ? "rgba(63, 72, 39, 0.06)" : "rgba(160, 60, 40, 0.07)",
          }}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
