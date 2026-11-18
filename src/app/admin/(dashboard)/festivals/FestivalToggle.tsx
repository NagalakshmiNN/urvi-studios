"use client";

import { useTransition } from "react";
import { toggleFestivalActiveAction } from "@/app/actions/festival";

export default function FestivalToggle({ eventId, active }: { eventId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: pending ? "wait" : "pointer" }}>
      <div
        style={{
          position: "relative",
          width: 44,
          height: 24,
          borderRadius: 12,
          background: active ? "#4CAF50" : "#ccc",
          transition: "background 0.2s",
          opacity: pending ? 0.5 : 1,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: active ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </div>
      <input
        type="checkbox"
        checked={active}
        disabled={pending}
        onChange={(e) => startTransition(() => toggleFestivalActiveAction(eventId, e.target.checked))}
        style={{ display: "none" }}
      />
      <span style={{ fontSize: 12, color: active ? "#4CAF50" : "#999", fontWeight: 600 }}>
        {pending ? "..." : active ? "ON" : "OFF"}
      </span>
    </label>
  );
}
