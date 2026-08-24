"use client";

import { useTransition } from "react";
import { updateOrderStatusAction } from "@/app/actions/admin";

const STATUSES = ["PLACED", "CONFIRMED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"];

export default function OrderStatusForm({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      className="status-select"
      defaultValue={currentStatus}
      disabled={pending}
      onChange={(e) => startTransition(() => updateOrderStatusAction(orderId, e.target.value))}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
      ))}
    </select>
  );
}
