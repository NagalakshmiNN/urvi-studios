"use client";

// Whether payments work, answered here rather than in a hosting dashboard.
//
// When checkout fails, the customer sees "Could not start payment" and the
// real reason — a rejected key, a missing secret, a stray space — exists only
// as a line in a serverless function log. Finding that means knowing where a
// hosting platform keeps its logs, which is not reasonable to expect of
// someone running a clothing shop.

import { useState, useTransition } from "react";
import { checkRazorpayAction, type ConnectionCheck } from "@/app/actions/admin";

export default function PaymentsHealth() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ConnectionCheck | null>(null);

  return (
    <div style={{ marginTop: 28, padding: "16px 18px", border: "1px solid var(--line, #e2e0d8)", borderRadius: 10 }}>
      <h3 style={{ fontSize: 15, margin: "0 0 4px" }}>Payments</h3>
      <p style={{ fontSize: 12.5, color: "var(--sage)", margin: "0 0 12px", lineHeight: 1.7 }}>
        Asks Razorpay whether the keys on this site work. Nothing is charged and no secret is shown.
      </p>

      <button
        type="button"
        className="btn-outline"
        disabled={pending}
        style={{ fontSize: 13, padding: "7px 14px" }}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            setResult(await checkRazorpayAction());
          })
        }
      >
        {pending ? "Checking…" : "Check Razorpay connection"}
      </button>

      {result && (
        <div
          role="status"
          style={{
            marginTop: 12,
            fontSize: 13,
            lineHeight: 1.75,
            padding: "11px 13px",
            borderRadius: 8,
            border: "1px solid var(--line, #e2e0d8)",
            background: result.ok ? "rgba(63, 72, 39, 0.06)" : "rgba(160, 60, 40, 0.07)",
          }}
        >
          <p style={{ margin: 0 }}>{result.message}</p>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--sage)" }}>
            Key ID: {result.keyId ? <code>{result.keyId}</code> : "not set"}
            <br />
            Key secret: {result.keySecretLength > 0 ? `set, ${result.keySecretLength} characters` : "not set"}
            <br />
            Webhook secret: {result.webhookSecretSet ? "set" : "not set"}
          </p>
        </div>
      )}
    </div>
  );
}
