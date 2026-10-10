import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

/** Read a site setting by key. Returns null if the key doesn't exist. */
export async function getSiteSetting(key: string): Promise<string | null> {
  try {
    const row = await db.query.siteSettings.findFirst({
      where: eq(schema.siteSettings.key, key),
    });
    return row?.value ?? null;
  } catch {
    // Table may not exist yet (migration pending) — return null so callers
    // fall back to their defaults instead of crashing the page.
    return null;
  }
}

/** Read a boolean site setting (stored as "true"/"false"). Defaults to false. */
export async function getBoolSetting(key: string): Promise<boolean> {
  const v = await getSiteSetting(key);
  return v === "true";
}

/** Write a site setting (upsert). */
export async function setSiteSetting(key: string, value: string) {
  await db
    .insert(schema.siteSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.siteSettings.key,
      set: { value, updatedAt: new Date() },
    });
}
