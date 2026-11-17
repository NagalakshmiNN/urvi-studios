"use server";

import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createFestivalAction(formData: FormData) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name is required");

  const slug = slugify(name);
  const tagline = String(formData.get("tagline") || "").trim() || null;
  const startsAt = new Date(String(formData.get("startsAt") || ""));
  const endsAt = new Date(String(formData.get("endsAt") || ""));

  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
    throw new Error("Valid start and end dates are required");
  }
  if (endsAt <= startsAt) {
    throw new Error("End date must be after start date");
  }

  const theme = String(formData.get("theme") || "gold");
  const bannerText = String(formData.get("bannerText") || "").trim() || null;
  const bannerSub = String(formData.get("bannerSub") || "").trim() || null;
  const animation = String(formData.get("animation") || "confetti");
  const discountType = String(formData.get("discountType") || "").trim() || null;
  const discountValueRaw = String(formData.get("discountValue") || "").trim();
  const discountValue = discountValueRaw ? parseInt(discountValueRaw, 10) : null;
  const badgeText = String(formData.get("badgeText") || "SALE").trim();
  const isActive = formData.get("isActive") === "on";
  const showMascot = formData.get("showMascot") === "on";
  const mascotMessage = String(formData.get("mascotMessage") || "").trim() || null;

  await db.insert(schema.festivalEvents).values({
    slug,
    name,
    tagline,
    startsAt,
    endsAt,
    theme,
    bannerText,
    bannerSub,
    animation,
    discountType,
    discountValue,
    badgeText,
    isActive,
    showMascot,
    mascotMessage,
  });

  revalidatePath("/");
  revalidatePath("/admin/festivals");
  redirect("/admin/festivals");
}

export async function updateFestivalAction(formData: FormData) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Event ID is required");

  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name is required");

  const tagline = String(formData.get("tagline") || "").trim() || null;
  const startsAt = new Date(String(formData.get("startsAt") || ""));
  const endsAt = new Date(String(formData.get("endsAt") || ""));

  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
    throw new Error("Valid start and end dates are required");
  }

  const theme = String(formData.get("theme") || "gold");
  const bannerText = String(formData.get("bannerText") || "").trim() || null;
  const bannerSub = String(formData.get("bannerSub") || "").trim() || null;
  const animation = String(formData.get("animation") || "confetti");
  const discountType = String(formData.get("discountType") || "").trim() || null;
  const discountValueRaw = String(formData.get("discountValue") || "").trim();
  const discountValue = discountValueRaw ? parseInt(discountValueRaw, 10) : null;
  const badgeText = String(formData.get("badgeText") || "SALE").trim();
  const isActive = formData.get("isActive") === "on";
  const showMascot = formData.get("showMascot") === "on";
  const mascotMessage = String(formData.get("mascotMessage") || "").trim() || null;

  await db
    .update(schema.festivalEvents)
    .set({
      name,
      tagline,
      startsAt,
      endsAt,
      theme,
      bannerText,
      bannerSub,
      animation,
      discountType,
      discountValue,
      badgeText,
      isActive,
      showMascot,
      mascotMessage,
    })
    .where(eq(schema.festivalEvents.id, id));

  revalidatePath("/");
  revalidatePath("/admin/festivals");
  redirect("/admin/festivals");
}

export async function deleteFestivalAction(formData: FormData) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Event ID is required");

  await db.delete(schema.festivalEvents).where(eq(schema.festivalEvents.id, id));

  revalidatePath("/");
  revalidatePath("/admin/festivals");
  redirect("/admin/festivals");
}
