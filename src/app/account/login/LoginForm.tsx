"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";

export default function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next || "/account"} />
      {state?.error && <div className="notice-box error">{state.error}</div>}
      <div className="form-group">
        <label>Email</label>
        <input type="email" name="email" required autoComplete="email" />
      </div>
      <div className="form-group">
        <label>Password</label>
        <input type="password" name="password" required autoComplete="current-password" />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Logging in…" : "Login"}
      </button>
    </form>
  );
}
