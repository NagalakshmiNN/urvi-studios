import { db, schema } from "@/db";
import { and, eq, lte, gte } from "drizzle-orm";
export { FESTIVAL_THEMES } from "./festival-themes";

export type FestivalEvent = typeof schema.festivalEvents.$inferSelect;

/**
 * Returns the currently active festival event, if any.
 * An event is active when:
 * 1. is_active = true
 * 2. NOW is between starts_at and ends_at
 *
 * If multiple events overlap, the one that started most recently wins.
 * Returns null gracefully if the table doesn't exist yet (migration pending).
 */
export async function getActiveEvent(): Promise<FestivalEvent | null> {
  try {
    const now = new Date();
    const events = await db
      .select()
      .from(schema.festivalEvents)
      .where(
        and(
          eq(schema.festivalEvents.isActive, true),
          lte(schema.festivalEvents.startsAt, now),
          gte(schema.festivalEvents.endsAt, now),
        ),
      )
      .orderBy(schema.festivalEvents.startsAt)
      .limit(1);

    return events[0] ?? null;
  } catch {
    // Table may not exist yet (migration pending) — gracefully return null
    return null;
  }
}

/**
 * All upcoming or active events (for admin and countdown features).
 * Returns empty array gracefully if the table doesn't exist yet.
 */
export async function getUpcomingEvents(): Promise<FestivalEvent[]> {
  try {
    const now = new Date();
    return await db
      .select()
      .from(schema.festivalEvents)
      .where(
        and(
          eq(schema.festivalEvents.isActive, true),
          gte(schema.festivalEvents.endsAt, now),
        ),
      )
      .orderBy(schema.festivalEvents.startsAt);
  } catch {
    // Table may not exist yet (migration pending) — gracefully return empty
    return [];
  }
}
