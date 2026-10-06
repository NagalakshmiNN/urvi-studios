"use client";

import { useActionState, useState } from "react";
import { registerAction } from "@/app/actions/auth";

const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_DOMAIN_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const HAS_DIGIT = /\d/;
const HAS_SPECIAL = /[!@#$%^&*()_+\-=\[\]{};':"\|,.<>\/?]/;

export default function RegisterForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(registerAction, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(fd: FormData): boolean {
    const e: Record<string, string> = {};
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const password = String(fd.get("password") || "");

    if (!name || name.length < 2) e.name = "Please enter your full name.";
    if (!email) e.email = "Email is required.";
    else if (!EMAIL_DOMAIN_RE.test(email)) e.email = "Please enter a valid email address.";
    else {
      const domain = email.split("@")[1];
      const parts = domain.split(".");
      if (parts.length < 2 || parts[0].length < 2) e.email = "Please enter a valid email domain.";
    }
    if (phone && !PHONE_RE.test(phone.replace(/[\s-]/g, "")))
      e.phone = "Enter a valid 10-digit Indian mobile number starting with 6-9.";
    if (!password) e.password = "Password is required.";
    else if (password.length < 8) e.password = "Password must be at least 8 characters.";
    else if (!HAS_DIGIT.test(password)) e.password = "Password must include at least one digit.";
    else if (!HAS_SPECIAL.test(password)) e.password = "Password must include at least one special character.";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(fd: FormData) {
    if (!validate(fd)) return;
    formAction(fd);
  }

  return (
    <form action={handleSubmit}>
      <input type="hidden" name="next" value={next || "/account"} />
      {state?.error && <div className="notice-box error">{state.error}</div>}
      <div className="form-group">
        <label>Full name <span className="required">*</span></label>
        <input type="text" name="name" required autoComplete="name" />
        {errors.name && <p className="field-error">{errors.name}</p>}
      </div>
      <div className="form-group">
        <label>Email <span className="required">*</span></label>
        <input type="email" name="email" required autoComplete="email" />
        {errors.email && <p className="field-error">{errors.email}</p>}
      </div>
      <div className="form-group">
        <label>Phone</label>
        <input type="tel" name="phone" autoComplete="tel" maxLength={10} placeholder="10-digit mobile number" />
        {errors.phone && <p className="field-error">{errors.phone}</p>}
      </div>
      <div className="form-group">
        <label>Password <span className="required">*</span></label>
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
        <p className="field-hint">At least 8 characters, one digit, and one special character.</p>
        {errors.password && <p className="field-error">{errors.password}</p>}
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
