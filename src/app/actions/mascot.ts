"use server";

import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getSiteSetting, setSiteSetting } from "@/lib/site-settings";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// ─── Read helpers (no auth needed — called from public layout) ───────────

export async function getMascotSettings() {
  const [enabled, imageA, imageB] = await Promise.all([
    getSiteSetting("mascot_enabled"),
    getSiteSetting("mascot_image_a"),
    getSiteSetting("mascot_image_b"),
  ]);
  return {
    enabled: enabled === "true",
    imageA: imageA || "/mascots/mascot-ivory.png",
    imageB: imageB || "/mascots/mascot-mustard.png",
  };
}

export async function getMascotMessages() {
  try {
    const rows = await db.query.mascotMessages.findMany({
      where: eq(schema.mascotMessages.isActive, true),
      orderBy: asc(schema.mascotMessages.sortOrder),
    });
    return rows;
  } catch {
    return [];
  }
}

// ─── Admin-only read (includes inactive) ─────────────────────────────────

export async function getAllMascotMessages() {
  await getAdminSession();
  const rows = await db.query.mascotMessages.findMany({
    orderBy: asc(schema.mascotMessages.sortOrder),
  });
  return rows;
}

// ─── Admin mutations ─────────────────────────────────────────────────────

export async function toggleMascotEnabled(enabled: boolean) {
  await getAdminSession();
  await setSiteSetting("mascot_enabled", enabled ? "true" : "false");
  revalidatePath("/");
  revalidatePath("/admin/mascots");
}

export async function updateMascotMessage(
  id: string,
  data: { message?: string; animation?: string; isActive?: boolean; sortOrder?: number }
) {
  await getAdminSession();
  await db
    .update(schema.mascotMessages)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.mascotMessages.id, id));
  revalidatePath("/");
  revalidatePath("/admin/mascots");
}

export async function createMascotMessage(data: {
  message: string;
  animation: string;
  sortOrder: number;
}) {
  await getAdminSession();
  await db.insert(schema.mascotMessages).values({
    message: data.message,
    animation: data.animation,
    sortOrder: data.sortOrder,
    isActive: true,
  });
  revalidatePath("/");
  revalidatePath("/admin/mascots");
}

export async function deleteMascotMessage(id: string) {
  await getAdminSession();
  await db.delete(schema.mascotMessages).where(eq(schema.mascotMessages.id, id));
  revalidatePath("/");
  revalidatePath("/admin/mascots");
}

export async function uploadMascotImage(formData: FormData) {
  await getAdminSession();

  const file = formData.get("file") as File | null;
  const slot = formData.get("slot") as string; // "a" or "b"

  if (!file || !slot) throw new Error("Missing file or slot");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const filename = `mascot-${slot === "a" ? "ivory" : "mustard"}-${Date.now()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "mascots");

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);

  const publicPath = `/mascots/${filename}`;
  await setSiteSetting(
    slot === "a" ? "mascot_image_a" : "mascot_image_b",
    publicPath
  );

  revalidatePath("/");
  revalidatePath("/admin/mascots");
  return publicPath;
}

export async function bulkUpdateMascotMessages(
  messages: { id?: string; message: string; animation: string; sortOrder: number; isActive: boolean }[]
) {
  await getAdminSession();

  for (const msg of messages) {
    if (msg.id) {
      await db
        .update(schema.mascotMessages)
        .set({
          message: msg.message,
          animation: msg.animation,
          sortOrder: msg.sortOrder,
          isActive: msg.isActive,
          updatedAt: new Date(),
        })
        .where(eq(schema.mascotMessages.id, msg.id));
    } else {
      await db.insert(schema.mascotMessages).values({
        message: msg.message,
        animation: msg.animation,
        sortOrder: msg.sortOrder,
        isActive: msg.isActive,
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/admin/mascots");
}
