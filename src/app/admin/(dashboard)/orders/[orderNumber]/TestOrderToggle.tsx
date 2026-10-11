"use client";

import { useState, useTransition } from "react";
import { toggleTestOrderAction } from "@/app/actions/admin";

export default function TestOrderToggle({ orderId, isTest }: { orderId: string; isTest: boolean }) {
  const [test, setTest] = useState(isTest);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleTestOrderAction(orderId);
      if (result?.success) setTest(result.isTest);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      title={test ? "This order is excluded from reports. Click to include it." : "Click to mark as test order (excludes from reports)"}
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 4,
        border: "1px solid",
        cursor: isPending ? "wait" : "pointer",
        background: test ? "rgba(180,50,50,0.08)" : "rgba(0,0,0,0.04)",
        color: test ? "#b43232" : "var(--sage)",
        borderColor: test ? "rgba(180,50,50,0.2)" : "rgba(0,0,0,0.1)",
        fontWeight: 600,
      }}
    >
      {isPending ? "…" : test ? "TEST — click to include" : "Mark as test"}
    </button>
  );
}
