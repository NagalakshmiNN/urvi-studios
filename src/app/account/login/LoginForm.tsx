"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";

export default function LoginForm({ next, email }: { next?: string; email?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next || "/account"} />
      {state?.error && <div className="notice-box error">{state.error}</div>}
      <div className="form-group">
        <label>Email <span className="required">*</span></label>
        <input type="email" name="email" required autoComplete="email" defaultValue={email} />
      </div>
      <div className="form-group">
        <label>Password <span className="required">*</span></label>
        <div className="password-field">
          <input type={showPassword ? "text" : "password"} name="password" required autoComplete="current-password" />
          <button type="button" className="eye-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
      </div>
      <div style={{ textAlign: "right", marginTop: -4, marginBottom: 16 }}>
        <Link href="/account/forgot-password" className="forgot-link">Forgot Password?</Link>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Logging in…" : "Login"}
      </button>
    </form>
  );
}
