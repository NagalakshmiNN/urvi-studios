"use client";

// Logging out has to clear the bag too.
//
// The session lives in a cookie the server clears, but the bag lives in this
// browser's localStorage and the server cannot touch it. So signing out used
// to end with someone else's chosen pieces still sitting in the cart, and the
// count still showing in the header — on a shared laptop, a stranger seeing
// what you had been shopping for.
//
// Clearing happens here, in the browser, before the server action runs.

import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";
import { clearCart } from "@/lib/cart";

export default function LogoutButton({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => {
        // Wrapped: localStorage throws in a private window or with site data
        // blocked, and a browser that refuses to forget the cart must not also
        // refuse to sign the person out.
        try {
          clearCart();
        } catch {
          // Nothing to do — logging out is still the more important half.
        }
        startTransition(() => logoutAction());
      }}
    >
      {pending ? "Signing out…" : "Logout"}
    </button>
  );
}
