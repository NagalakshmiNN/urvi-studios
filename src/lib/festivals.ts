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
 */
export async function getActiveEvent(): Promise<FestivalEvent | null> {
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
}

/**
 * All upcoming or active events (for admin and countdown features).
 */
export async function getUpcomingEvents(): Promise<FestivalEvent[]> {
  const now = new Date();
  return db
    .select()
    .from(schema.festivalEvents)
    .where(
      and(
        eq(schema.festivalEvents.isActive, true),
        gte(schema.festivalEvents.endsAt, now),
      ),
    )
    .orderBy(schema.festivalEvents.startsAt);
}
