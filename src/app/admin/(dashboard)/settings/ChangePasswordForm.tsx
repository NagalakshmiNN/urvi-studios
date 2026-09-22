"use client";

import { useActionState } from "react";
import { changeAdminPasswordAction } from "@/app/actions/admin";
import { MIN_ADMIN_PASSWORD_LENGTH } from "@/lib/password-rules";

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changeAdminPasswordAction, undefined);

  return (
    <form action={formAction} style={{ maxWidth: 420 }}>
      <label className="field">
        <span>Current password</span>
        <input type="password" name="currentPassword" required autoComplete="current-password" />
      </label>

      <label className="field">
        <span>New password</span>
        <input
          type="password"
          name="newPassword"
          required
          minLength={MIN_ADMIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
      </label>

      <label className="field">
        <span>New password again</span>
        <input type="password" name="confirmPassword" required autoComplete="new-password" />
      </label>

      <p style={{ fontSize: 12.5, color: "var(--sage)", lineHeight: 1.7, margin: "0 0 16px" }}>
        At least {MIN_ADMIN_PASSWORD_LENGTH} characters. A few ordinary words you&apos;ll remember beat a short
        one full of symbols. Changing this signs out every other device.
      </p>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Changing…" : "Change password"}
      </button>

      {state?.error && (
        <p role="alert" style={{ marginTop: 14, fontSize: 13.5, color: "#a03c28" }}>{state.error}</p>
      )}
      {state?.success && (
        <p role="status" style={{ marginTop: 14, fontSize: 13.5, color: "var(--olive, #3f4827)" }}>{state.success}</p>
      )}
    </form>
  );
}
