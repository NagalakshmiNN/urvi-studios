"use client";

import { useActionState } from "react";
import { saveVendorAction, type PricingFormState } from "@/app/actions/purchases";

export default function VendorForm() {
  const [state, action, pending] = useActionState<PricingFormState, FormData>(saveVendorAction, undefined);

  return (
    <form action={action} className="admin-form-card">
      <div className="form-group">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required />
      </div>
      <div className="form-group">
        <label htmlFor="businessName">Business name</label>
        <input id="businessName" name="businessName" />
        <span className="field-hint">Only if it differs from the name above.</span>
      </div>
      <div className="form-group">
        <label htmlFor="city">City</label>
        <input id="city" name="city" />
      </div>
      <div className="form-group">
        <label htmlFor="state">State</label>
        <input id="state" name="state" />
      </div>
      <div className="form-group">
        <label htmlFor="gstin">GSTIN</label>
        <input id="gstin" name="gstin" style={{ textTransform: "uppercase" }} />
        <span className="field-hint">The PAN is read out of this if you leave the PAN blank.</span>
      </div>
      <div className="form-group">
        <label htmlFor="pan">PAN</label>
        <input id="pan" name="pan" style={{ textTransform: "uppercase" }} />
      </div>
      <div className="form-group">
        <label htmlFor="type">Type</label>
        <input id="type" name="type" placeholder="Wholesaler, Manufacturer, Agent" />
      </div>
      <div className="form-group">
        <label htmlFor="contactPerson">Contact</label>
        <input id="contactPerson" name="contactPerson" />
      </div>
      <div className="form-group">
        <label htmlFor="phone">Phone</label>
        <input id="phone" name="phone" />
      </div>
      <div className="form-group">
        <label htmlFor="paymentTerms">Payment terms</label>
        <input id="paymentTerms" name="paymentTerms" placeholder="Advance only, 30 days" />
      </div>

      {state?.error && <div className="form-error">{state.error}</div>}
      {state?.success && <div className="form-success">{state.success}</div>}

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Add vendor"}
      </button>
    </form>
  );
}
