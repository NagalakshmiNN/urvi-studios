"use client";

import { useActionState } from "react";
import { registerAction } from "@/app/actions/auth";

export default function RegisterForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(registerAction, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next || "/account"} />
      {state?.error && <div className="notice-box error">{state.error}</div>}
      <div className="form-group">
        <label>Full name</label>
        <input type="text" name="name" required autoComplete="name" />
      </div>
      <div className="form-group">
        <label>Email</label>
        <input type="email" name="email" required autoComplete="email" />
      </div>
      <div className="form-group">
        <label>Phone</label>
        <input type="tel" name="phone" autoComplete="tel" />
      </div>
      <div className="form-group">
        <label>Password</label>
        <input type="password" name="password" required minLength={8} autoComplete="new-password" />
        <p className="field-hint">At least 8 characters.</p>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
