// Emails the shop's shared inbox (which both Nagalakshmi and Shilpa check)
// the moment an order is placed — a stand-in for a true automated WhatsApp
// push, which needs a WhatsApp Business API account that isn't set up yet.
// Reuses the same Gmail SMTP transport as the contact-form alerts, and
// never lets a failed send block the actual order (see sendMail).

import { sendMail } from "./mailer";
import { SITE } from "./site-config";
import { formatINR } from "./format";
import { STATUS_LABELS, STATUS_CUSTOMER_LINES } from "./order-status-copy";

type NotifyLine = { productName: string; sku: string; size: string; color: string; qty: number; price: number };

type NotifyOrder = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
};

export async function sendOrderNotification(order: NotifyOrder, lines: NotifyLine[]) {
  const itemLines = lines
    .map((l) => `• ${l.productName} [ID: ${l.sku || "—"}] (${l.size}, ${l.color}) x${l.qty} — ${formatINR(l.price * l.qty)}`)
    .join("\n");

  const paidLine =
    order.paymentStatus === "PAID"
      ? "Paid via Razorpay ✅"
      : order.paymentMethod === "whatsapp_cod"
      ? "Payment pending — confirm with the customer over WhatsApp/COD"
      : "Payment pending";

  const address = [order.addressLine1, order.city, order.state, order.pincode].filter(Boolean).join(", ") || "No address on file yet";

  const text =
    `New order ${order.orderNumber}\n\n${itemLines}\n\nTotal: ${formatINR(order.total)}\n${paidLine}\n\n` +
    `Customer: ${order.customerName}\nPhone: ${order.customerPhone}\nEmail: ${order.customerEmail || "—"}\n` +
    `Address: ${address}\n\n` +
    `View in admin: https://urvi-studios.netlify.app/admin/orders/${order.orderNumber}`;

  await sendMail({
    to: SITE.contactEmail,
    subject: `New order ${order.orderNumber} — ${formatINR(order.total)}`,
    text,
  });
}

// ------------------------------------------------------- Customer-facing

// The order confirmation sent to the customer themselves (not the shop
// inbox) — once when the order is actually placed (immediately for a
// WhatsApp/COD order, or once Razorpay payment verifies). Silently does
// nothing if the order somehow has no email on file — never blocks the
// order itself either way (see sendMail).
export async function sendCustomerOrderConfirmation(order: NotifyOrder, lines: NotifyLine[], opts?: { newAccountEmail?: string }) {
  if (!order.customerEmail) return;

  const itemLines = lines
    .map((l) => `• ${l.productName} [ID: ${l.sku || "—"}] (${l.size}, ${l.color}) x${l.qty} — ${formatINR(l.price * l.qty)}`)
    .join("\n");

  const address = [order.addressLine1, order.city, order.state, order.pincode].filter(Boolean).join(", ");

  const accountNote = opts?.newAccountEmail
    ? `\n\nWe've saved your details under an account so you can track this (and any future orders) any time — you're already signed in on this device under ${opts.newAccountEmail}. Look for "My Account" on the site.\n`
    : "";

  const text =
    `Hi ${order.customerName},\n\nThanks for shopping with Urvi Studios! We've received your order ${order.orderNumber}.\n\n` +
    `${itemLines}\n\nTotal: ${formatINR(order.total)}\n\nDelivering to: ${address}\n` +
    accountNote +
    `\nWe'll email you again as your order is confirmed, shipped, and delivered.\n\n` +
    `Track it any time: ${SITE.siteUrl}/account/orders/${order.orderNumber}\n\n— Urvi Studios`;

  await sendMail({
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} received — Urvi Studios`,
    text,
  });
}

// Sent to the customer whenever an admin moves an order to a new status
// (Confirmed/Shipped/Out for Delivery/Delivered/Cancelled/Returned) — see
// updateOrderStatusAction. PLACED is intentionally not in
// STATUS_CUSTOMER_LINES' set of triggers here since the confirmation email
// above already covers that moment.
export async function sendCustomerStatusUpdate(order: NotifyOrder, status: string) {
  if (!order.customerEmail) return;
  const line = STATUS_CUSTOMER_LINES[status];
  const label = STATUS_LABELS[status];
  if (!line || !label) return;

  const text =
    `Hi ${order.customerName},\n\n${line}\n\n` +
    `Order ${order.orderNumber} — ${formatINR(order.total)}\n\n` +
    `Track it any time: ${SITE.siteUrl}/account/orders/${order.orderNumber}\n\n— Urvi Studios`;

  await sendMail({
    to: order.customerEmail,
    subject: `Order ${order.orderNumber}: ${label}`,
    text,
  });
}
