import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";

/**
 * One-time helper: fetches recent messages the Telegram bot has received
 * so we can find the group chat ID. Visit /api/admin/telegram-setup after
 * sending a message in the group.
 *
 * Delete this file once the TELEGRAM_CHAT_ID env var is set.
 */
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not admin" }, { status: 401 });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({
      error: "TELEGRAM_BOT_TOKEN is not set. Add it to Netlify env vars first.",
    });
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const data = await res.json();

  if (!data.ok) {
    return NextResponse.json({ error: "Telegram API error", details: data });
  }

  // Extract unique chats
  const chats = new Map<string, { id: number; title?: string; type: string }>();
  for (const update of data.result ?? []) {
    const msg = update.message ?? update.my_chat_member?.chat;
    if (msg?.chat) {
      const c = msg.chat;
      chats.set(String(c.id), { id: c.id, title: c.title, type: c.type });
    }
  }

  return NextResponse.json({
    instruction:
      "Copy the 'id' of your group chat below and set it as TELEGRAM_CHAT_ID in Netlify env vars. " +
      "Then delete this file (src/app/api/admin/telegram-setup/route.ts).",
    chats: [...chats.values()],
  });
}
