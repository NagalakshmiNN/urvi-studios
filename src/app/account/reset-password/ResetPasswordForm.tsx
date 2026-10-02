"use client";

import { useActionState, useState } from "react";
import { resetPasswordAction } from "@/app/actions/forgot-password";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, undefined);
  const [showPassword, setShowPassword] = useState(false);

  if (state?.success) {
    return (
      <div>
        <div className="notice-box success">
          Your password has been reset successfully.
        </div>
        <a href="/account/login" className="btn btn-primary btn-block" style={{ marginTop: 16, textAlign: "center", display: "block" }}>
          Login with new password
        </a>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      {state?.error && <div className="notice-box error">{state.error}</div>}
      <div className="form-group">
        <label>New Password <span className="required">*</span></label>
        <div className="password-field">
          <input type={showPassword ? "text" : "password"} name="password" required minLength={8} autoComplete="new-password" />
          <button type="button" className="eye-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
        <p className="field-hint">At least 8 characters.</p>
      </div>
      <div className="form-group">
        <label>Confirm Password <span className="required">*</span></label>
        <div className="password-field">
          <input type={showPassword ? "text" : "password"} name="confirm" required minLength={8} autoComplete="new-password" />
        </div>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Resetting…" : "Reset Password"}
      </button>
    </form>
  );
}
