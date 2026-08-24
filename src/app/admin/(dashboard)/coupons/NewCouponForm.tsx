"use client";

import { useActionState, useRef, useEffect } from "react";
import { createCouponAction } from "@/app/actions/admin";

export default function NewCouponForm() {
  const [state, formAction, pending] = useActionState(createCouponAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form action={formAction} ref={formRef}>
      {state?.error && <div className="notice-box error">{state.error}</div>}
      {state?.success && <div className="notice-box">{state.success}</div>}
      <div className="form-row">
        <div className="form-group">
          <label>Code</label>
          <input type="text" name="code" required placeholder="WELCOME10" style={{ textTransform: "uppercase" }} />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select name="type" defaultValue="PERCENT">
            <option value="PERCENT">Percent off</option>
            <option value="FLAT">Flat amount off</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Value</label>
          <input type="number" name="value" required min={1} placeholder="10" />
        </div>
        <div className="form-group">
          <label>Minimum order (₹, optional)</label>
          <input type="number" name="minOrderValue" min={0} placeholder="1500" />
        </div>
      </div>
      <button type="submit" className="btn btn-outline" disabled={pending}>{pending ? "Creating…" : "Create Coupon"}</button>
    </form>
  );
}
