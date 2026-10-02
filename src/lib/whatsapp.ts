// WhatsApp Cloud API integration for admin alerts.
//
// Uses Meta's official WhatsApp Cloud API (free for the first 1,000
// conversations/month). Sends text messages to the configured admin
// number whenever something noteworthy happens — a new customer signs up,
// a paid order comes in.
//
// Required env vars:
//   WHATSAPP_ACCESS_TOKEN     – Permanent token from Meta Developer Console
//   WHATSAPP_PHONE_NUMBER_ID  – The phone number ID (not the phone number
//                               itself) from Meta's WhatsApp > API Setup
//   WHATSAPP_ADMIN_PHONE      – The admin's WhatsApp number to receive
//                               alerts, with country code, no + or spaces
//                               (e.g. 919538559595)
//
// Like sendMail, this never throws — callers should not let a failed
// notification block the actual operation.

const API_VERSION = "v21.0";

function getConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const adminPhone = process.env.WHATSAPP_ADMIN_PHONE;
  if (!token || !phoneId || !adminPhone) return null;
  return { token, phoneId, adminPhone };
}

/** Whether the three WhatsApp env vars are all set. */
export function whatsappConfigured(): boolean {
  return getConfig() !== null;
}

/** Which of the three settings is missing, named individually. */
export function missingWhatsappSettings(): string[] {
  const missing: string[] = [];
  if (!process.env.WHATSAPP_ACCESS_TOKEN) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!process.env.WHATSAPP_ADMIN_PHONE) missing.push("WHATSAPP_ADMIN_PHONE");
  return missing;
}

export type WhatsAppResult = { sent: true } | { sent: false; reason: string };

/**
 * Send a plain text WhatsApp message to the admin phone number.
 *
 * Never throws — returns { sent: false, reason } on any failure.
 */
export async function sendWhatsApp(text: string): Promise<WhatsAppResult> {
  const config = getConfig();
  if (!config) {
    const missing = missingWhatsappSettings();
    const reason =
      `WhatsApp not configured: ${missing.join(" and ")} ` +
      `${missing.length === 1 ? "is" : "are"} not set.`;
    console.warn(`sendWhatsApp skipped: ${reason}`);
    return { sent: false, reason };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${config.phoneId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: config.adminPhone,
          type: "text",
          text: { body: text },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("WhatsApp API error:", res.status, errBody);
      return { sent: false, reason: `WhatsApp API returned ${res.status}` };
    }

    return { sent: true };
  } catch (err) {
    console.error("sendWhatsApp failed:", err);
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "WhatsApp send failed",
    };
  }
}

// ------------------------------------------------ Click-to-chat helpers
//
// Tap-to-send links for the admin to message a customer — not automated
// sending (which uses sendWhatsApp above). These predate the Cloud API
// integration and are still used on the admin order-detail page.

/** Best-effort normalize to the country-code-prefixed digits wa.me expects. */
export function normalizeIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${normalizeIndianPhone(phone)}?text=${encodeURIComponent(message)}`;
}
