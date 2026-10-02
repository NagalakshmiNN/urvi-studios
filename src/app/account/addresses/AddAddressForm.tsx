"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { addAddressAction } from "@/app/actions/address";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

export default function AddAddressForm() {
  const [state, formAction, pending] = useActionState(addAddressAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!state?.error && !pending) {
      formRef.current?.reset();
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  function validate(fd: FormData): boolean {
    const e: Record<string, string> = {};
    const phone = String(fd.get("phone") || "").trim();
    const pincode = String(fd.get("pincode") || "").trim();
    const city = String(fd.get("city") || "").trim();
    const line1 = String(fd.get("line1") || "").trim();
    const stateVal = String(fd.get("state") || "").trim();

    if (!line1) e.line1 = "Address is required.";
    else if (line1.length < 5) e.line1 = "Please enter a complete address.";

    if (!phone) e.phone = "Phone number is required.";
    else if (!/^[6-9]\d{9}$/.test(phone.replace(/[\s-]/g, "")))
      e.phone = "Enter a valid 10-digit Indian mobile number.";

    if (!city) e.city = "City is required.";
    else if (!/^[A-Za-z\s.'-]{2,}$/.test(city))
      e.city = "City should contain only letters.";

    if (!stateVal) e.state = "State is required.";

    if (!pincode) e.pincode = "Pincode is required.";
    else if (!/^\d{6}$/.test(pincode))
      e.pincode = "Enter a valid 6-digit pincode.";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(fd: FormData) {
    if (!validate(fd)) return;
    formAction(fd);
  }

  return (
    <form action={handleSubmit} ref={formRef} className="address-form">
      {state?.error && <div className="notice-box error">{state.error}</div>}
      {state?.success && <div className="notice-box success">Address saved successfully!</div>}
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
          <label>Phone <span className="required">*</span></label>
          <input type="tel" name="phone" required placeholder="10-digit mobile number" maxLength={10} />
          {errors.phone && <p className="field-error">{errors.phone}</p>}
        </div>
      </div>
      <div className="form-group">
        <label>Address <span className="required">*</span></label>
        <input type="text" name="line1" required placeholder="House no, street, area" />
        {errors.line1 && <p className="field-error">{errors.line1}</p>}
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>City <span className="required">*</span></label>
          <input type="text" name="city" required placeholder="e.g. Bangalore" />
          {errors.city && <p className="field-error">{errors.city}</p>}
        </div>
        <div className="form-group">
          <label>State <span className="required">*</span></label>
          <select name="state" required defaultValue="">
            <option value="" disabled>Select state</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {errors.state && <p className="field-error">{errors.state}</p>}
        </div>
        <div className="form-group">
          <label>Pincode <span className="required">*</span></label>
          <input type="text" name="pincode" required maxLength={6} placeholder="6 digits" inputMode="numeric" pattern="\d{6}" />
          {errors.pincode && <p className="field-error">{errors.pincode}</p>}
        </div>
      </div>
      <button type="submit" className="btn btn-outline" disabled={pending}>
        {pending ? "Saving…" : "Save Address"}
      </button>
    </form>
  );
}
