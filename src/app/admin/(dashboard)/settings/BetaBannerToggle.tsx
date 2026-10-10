"use client";

import { useState, useTransition } from "react";

export default function BetaBannerToggle({
  initialEnabled,
  toggleAction,
}: {
  initialEnabled: boolean;
  toggleAction: (enabled: boolean) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      await toggleAction(next);
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={handleToggle}
        disabled={isPending}
        style={{
          position: "relative",
          width: 44,
          height: 24,
          borderRadius: 12,
          border: "none",
          cursor: isPending ? "wait" : "pointer",
          background: enabled ? "var(--olive, #3F4827)" : "#ccc",
          transition: "background 0.2s",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: enabled ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </button>
      <span style={{ fontSize: 13.5, color: "var(--earth, #51462F)" }}>
        {enabled ? "Beta banner is visible to all visitors" : "Beta banner is hidden"}
        {isPending && " — saving…"}
      </span>
    </div>
  );
}
