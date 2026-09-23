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
      <div className="form-row">
        <div className="form-group">
          <label>Total uses allowed</label>
          <input type="number" name="usageLimit" min={1} placeholder="Leave blank for unlimited" />
        </div>
        <div className="form-group">
          <label>Uses allowed per customer</label>
          <input type="number" name="perCustomerLimit" min={1} placeholder="Leave blank for unlimited" />
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--sage)", marginBottom: 14, lineHeight: 1.6 }}>
        A code with no limits can be used by anyone who finds it, as often as they
        like, until you switch it off. For an Instagram offer, 1 per customer is
        usually what you mean.
      </p>
      <button type="submit" className="btn btn-outline" disabled={pending}>{pending ? "Creating…" : "Create Coupon"}</button>
    </form>
  );
}
