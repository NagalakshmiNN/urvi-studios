/**
 * Telegram Bot notifications for order events.
 *
 * Zero-paperwork alternative to WhatsApp Business API — just a bot token
 * and a chat ID.  Sends to a Telegram group where Drish + Shilpa receive
 * instant push notifications on their phones.
 *
 * Required env vars (set in Netlify dashboard):
 *   TELEGRAM_BOT_TOKEN  – from @BotFather (e.g. "123456:ABC-DEF1234…")
 *   TELEGRAM_CHAT_ID    – the group chat ID (e.g. "-1001234567890")
 *
 * Like sendMail, this never throws — callers should not let a failed
 * notification block the actual operation.
 */

const API = "https://api.telegram.org";

function getConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  return { token, chatId };
}

/** Whether both Telegram env vars are set. */
export function telegramConfigured(): boolean {
  return getConfig() !== null;
}

export type TelegramResult = { sent: true } | { sent: false; reason: string };

/**
 * Send a Markdown-formatted message to the configured Telegram group.
 * Never throws.
 */
export async function sendTelegram(text: string): Promise<TelegramResult> {
  const config = getConfig();
  if (!config) {
    console.warn("[telegram] Not configured — skipping send.");
    return { sent: false, reason: "Telegram not configured" };
  }

  try {
    const res = await fetch(
      `${API}/bot${config.token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text,
          parse_mode: "Markdown",
          // Don't show link previews for admin URLs
          disable_web_page_preview: true,
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[telegram] API error ${res.status}: ${errBody}`);
      return { sent: false, reason: `Telegram API returned ${res.status}` };
    }

    console.log("[telegram] Message sent.");
    return { sent: true };
  } catch (err) {
    console.error("[telegram] Network error:", err);
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Telegram send failed",
    };
  }
}

// ----------------------------------------------------------------
// Convenience: order-event formatters
// ----------------------------------------------------------------

interface OrderSummary {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: number; // in paise
  paymentMethod?: string;
  paymentStatus?: string;
  items?: Array<{ productName: string; size: string; qty: number }>;
}

function formatINR(paise: number): string {
  return "₹" + new Intl.NumberFormat("en-IN").format(Math.round(paise / 100));
}

function itemLines(items?: OrderSummary["items"]): string {
  if (!items || items.length === 0) return "";
  return items
    .map((i) => `  • ${i.productName} (${i.size}) ×${i.qty}`)
    .join("\n");
}

/** New order placed — alert to the group. */
export function sendNewOrderAlert(order: OrderSummary): Promise<TelegramResult> {
  const lines = [
    `🔔 *New Order!*`,
    ``,
    `*${order.orderNumber}*`,
    `Customer: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
  ];
  const items = itemLines(order.items);
  if (items) lines.push(``, items);
  lines.push(
    ``,
    `Total: *${formatINR(order.total)}*`,
    `Payment: ${order.paymentStatus ?? order.paymentMethod ?? "—"}`,
    ``,
    `[View order →](https://urvi-studios.netlify.app/admin/orders/${order.orderNumber})`
  );
  return sendTelegram(lines.join("\n"));
}

/** Status changed — shipped, out for delivery, delivered, etc. */
export function sendStatusAlert(
  orderNumber: string,
  customerName: string,
  newStatus: string
): Promise<TelegramResult> {
  const emoji: Record<string, string> = {
    Confirmed: "✅",
    Shipped: "🚚",
    "Out for Delivery": "📦",
    Delivered: "🎉",
    Cancelled: "❌",
    Returned: "↩️",
  };
  return sendTelegram(
    `${emoji[newStatus] ?? "📋"} *${orderNumber}* → *${newStatus}*\n` +
    `Customer: ${customerName}\n` +
    `[View →](https://urvi-studios.netlify.app/admin/orders/${orderNumber})`
  );
}
