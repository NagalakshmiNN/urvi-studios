"use client";

import { useActionState, useRef, useEffect } from "react";
import { addAddressAction } from "@/app/actions/address";

export default function AddAddressForm() {
  const [state, formAction, pending] = useActionState(addAddressAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.error && !pending) formRef.current?.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <form action={formAction} ref={formRef} className="address-form">
      {state?.error && <div className="notice-box error">{state.error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label>Label</label>
          <select name="label" defaultValue="Home">
            <option>Home</option>
            <option>Work</option>
            <option>Other</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: 2 }}>
          <label>Phone</label>
          <input type="tel" name="phone" required />
        </div>
      </div>
      <div className="form-group">
        <label>Address</label>
        <input type="text" name="line1" required placeholder="House no, street, area" />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>City</label>
          <input type="text" name="city" required />
        </div>
        <div className="form-group">
          <label>State</label>
          <input type="text" name="state" required />
        </div>
        <div className="form-group">
          <label>Pincode</label>
          <input type="text" name="pincode" required maxLength={6} />
        </div>
      </div>
      <button type="submit" className="btn btn-outline" disabled={pending}>
        {pending ? "Saving…" : "Save Address"}
      </button>
    </form>
  );
}
