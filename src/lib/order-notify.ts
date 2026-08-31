// Emails the shop's shared inbox (which both Nagalakshmi and Shilpa check)
// the moment an order is placed — a stand-in for a true automated WhatsApp
// push, which needs a WhatsApp Business API account that isn't set up yet.
// Reuses the same Gmail SMTP transport as the contact-form alerts, and
// never lets a failed send block the actual order (see sendMail).

import { sendMail } from "./mailer";
import { SITE } from "./site-config";
import { formatINR } from "./format";

type NotifyLine = { productName: string; size: string; color: string; qty: number; price: number };

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
    .map((l) => `• ${l.productName} (${l.size}, ${l.color}) x${l.qty} — ${formatINR(l.price * l.qty)}`)
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
