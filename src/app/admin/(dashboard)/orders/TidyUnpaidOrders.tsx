"use client";

// Clearing out orders that were never paid.
//
// Testing a payment gateway leaves a trail: every attempt creates an order
// before anyone pays, so a morning of trying leaves a dozen rows that look
// like real business and quietly skew the Money Map. Real abandoned
// checkouts accumulate the same way.
//
// Collapsed by default, because on most days there is nothing here worth
// doing. Nothing is pre-selected, and the count on the button says exactly
// what is about to go — deleting is not a thing to do by reflex.

import { useState, useTransition } from "react";
import { deleteUnpaidOrdersAction } from "@/app/actions/admin";

export type ClearableOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  total: string;
  date: string;
};

export default function TidyUnpaidOrders({ orders }: { orders: ClearableOrder[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (orders.length === 0) return null;

  const allSelected = selected.size === orders.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div style={{ marginTop: 28, padding: "16px 18px", border: "1px solid var(--line, #e2e0d8)", borderRadius: 10 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 14, color: "var(--sage)" }}
      >
        {open ? "▾" : "▸"} {orders.length} unpaid order{orders.length === 1 ? "" : "s"} can be cleared out
      </button>

      {open && (
        <>
          <p style={{ fontSize: 12.5, color: "var(--sage)", margin: "10px 0 14px", lineHeight: 1.7 }}>
            These were never paid and never took stock — test runs and abandoned checkouts. Paid orders are never
            listed here and cannot be deleted from this screen. Deleting cannot be undone.
          </p>

          <label style={{ display: "block", fontSize: 13, marginBottom: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.id)))}
              style={{ marginRight: 8 }}
            />
            Select all
          </label>

          <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 14 }}>
            {orders.map((o) => (
              <label
                key={o.id}
                style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 13, padding: "5px 0", cursor: "pointer" }}
              >
                <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{o.orderNumber}</span>
                <span style={{ color: "var(--sage)" }}>
                  {o.customerName} · {o.total} · {o.date}
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            className="btn-outline"
            disabled={pending || selected.size === 0}
            style={{ fontSize: 13, padding: "7px 14px" }}
            onClick={() => {
              if (!confirm(`Delete ${selected.size} unpaid order${selected.size === 1 ? "" : "s"}? This cannot be undone.`)) return;
              startTransition(async () => {
                setMessage(null);
                const r = await deleteUnpaidOrdersAction(Array.from(selected));
                setSelected(new Set());
                setMessage(r.message);
              });
            }}
          >
            {pending ? "Deleting…" : `Delete ${selected.size || ""} selected`.trim()}
          </button>

          {message && (
            <p role="status" style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7 }}>
              {message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
