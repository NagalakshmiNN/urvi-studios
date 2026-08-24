"use client";

import { useTransition } from "react";
import { toggleCouponActiveAction } from "@/app/actions/admin";

export default function CouponToggle({ couponId, active }: { couponId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      defaultChecked={active}
      disabled={pending}
      onChange={(e) => startTransition(() => toggleCouponActiveAction(couponId, e.target.checked))}
    />
  );
}
