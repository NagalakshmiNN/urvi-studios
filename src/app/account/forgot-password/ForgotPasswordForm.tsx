"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "@/app/actions/forgot-password";

export default function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, undefined);

  if (state?.success) {
    return (
      <div className="notice-box success">
        If an account exists with that email, we&apos;ve sent a password reset link. Please check your inbox.
      </div>
    );
  }

  return (
    <form action={formAction}>
      {state?.error && <div className="notice-box error">{state.error}</div>}
      <div className="form-group">
        <label>Email <span className="required">*</span></label>
        <input type="email" name="email" required autoComplete="email" placeholder="you@example.com" />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Sending…" : "Send Reset Link"}
      </button>
    </form>
  );
}
