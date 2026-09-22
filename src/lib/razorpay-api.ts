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

// ------------------------------------------------- Is Razorpay reachable at all

export type ConnectionCheck = {
  ok: boolean;
  keyId: string | null;
  keySecretLength: number;
  webhookSecretSet: boolean;
  message: string;
};

/**
 * Does this site's Razorpay configuration actually work?
 *
 * Separate from fetchOrderPayments because the question is different: not
 * "what happened to this payment" but "can we talk to Razorpay at all". When
 * checkout fails with "Could not start payment", the real reason is a line in
 * a server log, and a shop owner should not have to go looking for a hosting
 * platform's log viewer to find out that a key is wrong.
 *
 * Lists one order — the cheapest authenticated call there is — and reports
 * what came back. The key id is shown in full because it is public: it is
 * sent to every customer's browser, and seeing it here is how you check it
 * against the Razorpay dashboard. The secret is never shown; only its length,
 * which is what catches a truncated paste or a stray space.
 */
export async function checkConnection(): Promise<ConnectionCheck> {
  const keyId = process.env.RAZORPAY_KEY_ID ?? null;
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  const webhookSecretSet = Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);
  const base = { keyId, keySecretLength: keySecret.length, webhookSecretSet };

  if (!keyId && !keySecret) {
    return { ...base, ok: false, message: "No Razorpay keys are set on the site. Checkout falls back to the WhatsApp handoff." };
  }
  if (!keyId) return { ...base, ok: false, message: "RAZORPAY_KEY_SECRET is set but RAZORPAY_KEY_ID is missing." };
  if (!keySecret) return { ...base, ok: false, message: "RAZORPAY_KEY_ID is set but RAZORPAY_KEY_SECRET is missing or empty." };

  // A space or newline on either value survives copy-paste and breaks the
  // Basic auth header in a way that looks exactly like a wrong key.
  if (keyId !== keyId.trim() || keySecret !== keySecret.trim()) {
    return { ...base, ok: false, message: "One of the keys has a space or line break around it. Re-paste both values in Netlify without trailing whitespace." };
  }

  let res: Response;
  try {
    res = await fetch(`${API}/orders?count=1`, {
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` },
      cache: "no-store",
    });
  } catch (err) {
    return { ...base, ok: false, message: `Could not reach Razorpay: ${err instanceof Error ? err.message : "network error"}.` };
  }

  if (res.ok) {
    const mode = keyId.startsWith("rzp_live_") ? "live" : keyId.startsWith("rzp_test_") ? "test" : "unrecognised";
    return {
      ...base,
      ok: true,
      message: `Razorpay accepted these keys (${mode} mode).${webhookSecretSet ? "" : " The webhook secret is not set, so webhooks will be ignored."}`,
    };
  }

  const detail = await res.text().catch(() => "");
  let described = detail.slice(0, 300);
  try {
    const parsed = JSON.parse(detail) as { error?: { description?: string } };
    if (parsed.error?.description) described = parsed.error.description;
  } catch {
    // Not JSON; the raw text is better than nothing.
  }

  if (res.status === 401) {
    return {
      ...base,
      ok: false,
      message: `Razorpay rejected these keys (401). The key id and secret do not go together — usually a secret from a regenerated or different key pair. Regenerate the key in Razorpay and paste both halves into Netlify. Razorpay said: ${described}`,
    };
  }

  return { ...base, ok: false, message: `Razorpay refused the request (${res.status}). ${described}` };
}
