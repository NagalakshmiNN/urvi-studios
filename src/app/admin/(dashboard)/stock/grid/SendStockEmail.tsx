"use client";

// "Send it to me now."
//
// The report goes out on a schedule at seven each morning, which is a long
// wait to find out whether it works, or whether a change to it reads well on
// a phone. This runs the same code and sends the same email, on demand.

import { useState, useTransition } from "react";

export default function SendStockEmail() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className="btn btn-outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            try {
              // The admin session authorises this; no token is needed or sent
              // from the browser.
              const res = await fetch("/api/reports/stock-daily", { method: "POST" });
              const data = await res.json();
              setMessage(
                data.ok
                  ? `Sent to ${data.to} — ${data.pieces} pieces, ${data.garments} garments.`
                  : data.error || "Could not send the report."
              );
            } catch {
              setMessage("Could not reach the server. Please try again.");
            }
          })
        }
      >
        {pending ? "Sending…" : "Email it to me now"}
      </button>
      {message && (
        <span role="status" style={{ fontSize: 12.5, color: "var(--sage)", alignSelf: "center" }}>
          {message}
        </span>
      )}
    </>
  );
}
