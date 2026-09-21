// Asking Razorpay directly what happened to a payment.
//
// Everything else in this codebase learns about payments by being told —
// the customer's browser calls verify-payment, Razorpay's servers call the
// webhook. Both are push, and both can fail to arrive: a webhook registered
// in the wrong mode never fires at all, and a UPI QR paid in another app can
// leave the browser polling a window that never updates.
//
// When that happens the shop owner is left comparing two dashboards and
// guessing. This module is the pull half: given an order we created, go and
// ask Razorpay what became of it. It is the only source of truth that does
// not depend on a message reaching us.

const API = "https://api.razorpay.com/v1";

export type RazorpayPayment = {
  id: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amount: number;
  currency: string;
  method: string | null;
  email: string | null;
  contact: string | null;
  createdAt: number | null;
  errorDescription: string | null;
  errorReason: string | null;
};

export type LookupResult =
  | { ok: true; payments: RazorpayPayment[] }
  | { ok: false; reason: "not-configured" | "not-found" | "unauthorized" | "error"; detail?: string };

function auth(): string | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

/** The payment Razorpay actually took, if any — the one worth acting on. */
export function capturedPayment(payments: RazorpayPayment[]): RazorpayPayment | null {
  return payments.find((p) => p.status === "captured") ?? null;
}

/**
 * Every payment attempt Razorpay has recorded against one of our orders,
 * newest first. An order with no attempts comes back as an empty list, which
 * is a real answer — it means nobody ever got as far as paying — and is not
 * the same as the order not existing.
 */
export async function fetchOrderPayments(razorpayOrderId: string): Promise<LookupResult> {
  const basic = auth();
  if (!basic) return { ok: false, reason: "not-configured" };

  let res: Response;
  try {
    res = await fetch(`${API}/orders/${encodeURIComponent(razorpayOrderId)}/payments`, {
      headers: { Authorization: `Basic ${basic}` },
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, reason: "error", detail: err instanceof Error ? err.message : "Network error" };
  }

  // 401 is worth separating out: it means the keys in the environment are not
  // the keys that made this order — the exact confusion this module exists to
  // settle — and "no payments found" would be a misleading way to say so.
  if (res.status === 401) return { ok: false, reason: "unauthorized" };
  if (res.status === 400 || res.status === 404) return { ok: false, reason: "not-found" };
  if (!res.ok) return { ok: false, reason: "error", detail: `Razorpay returned ${res.status}` };

  let body: { items?: unknown[] };
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: "error", detail: "Razorpay sent a response we could not read." };
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const payments = items.map((raw) => {
    const p = raw as Record<string, unknown>;
    return {
      id: String(p.id ?? ""),
      status: String(p.status ?? "created") as RazorpayPayment["status"],
      amount: typeof p.amount === "number" ? p.amount : 0,
      currency: String(p.currency ?? "INR"),
      method: p.method ? String(p.method) : null,
      email: p.email ? String(p.email) : null,
      contact: p.contact ? String(p.contact) : null,
      createdAt: typeof p.created_at === "number" ? p.created_at : null,
      errorDescription: p.error_description ? String(p.error_description) : null,
      errorReason: p.error_reason ? String(p.error_reason) : null,
    };
  });

  payments.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return { ok: true, payments };
}

/** Plain English for the admin screen — no jargon, and never ambiguous about money. */
export function describePayments(payments: RazorpayPayment[]): string {
  if (payments.length === 0) {
    return "Razorpay has no payment attempt against this order. Nobody reached the point of paying, so no money has moved.";
  }

  const captured = capturedPayment(payments);
  if (captured) {
    const rupees = (captured.amount / 100).toFixed(2);
    return `Razorpay took ₹${rupees} by ${captured.method ?? "an unknown method"} (${captured.id}). The money is with Razorpay.`;
  }

  const authorized = payments.find((p) => p.status === "authorized");
  if (authorized) {
    return `A payment is authorised but not captured (${authorized.id}). The money is held, not taken — capture or refund it in the Razorpay dashboard.`;
  }

  const failed = payments.find((p) => p.status === "failed");
  if (failed) {
    const why = failed.errorDescription || failed.errorReason || "no reason given";
    return `The payment attempt failed — ${why}. No money was taken.`;
  }

  return `${payments.length} payment attempt${payments.length === 1 ? "" : "s"}, none completed. No money has been taken.`;
}
