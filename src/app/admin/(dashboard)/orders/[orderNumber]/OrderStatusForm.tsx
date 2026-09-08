"use client";

import { useTransition } from "react";
import { updateOrderStatusAction } from "@/app/actions/admin";
import { statusesFor, statusLabel } from "@/lib/order-status-copy";

export default function OrderStatusForm({
  orderId,
  currentStatus,
  fulfilmentMethod,
}: {
  orderId: string;
  currentStatus: string;
  fulfilmentMethod?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  // An order being collected in person is never shipped or out for delivery,
  // so those options aren't offered — and the rest read as "ready to
  // collect" and "collected".
  const statuses = statusesFor(fulfilmentMethod);

  return (
    <select
      className="status-select"
      defaultValue={currentStatus}
      disabled={pending}
      onChange={(e) => startTransition(() => updateOrderStatusAction(orderId, e.target.value))}
    >
      {statuses.map((s) => (
        <option key={s} value={s}>{statusLabel(s, fulfilmentMethod)}</option>
      ))}
    </select>
  );
}
