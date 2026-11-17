import { db, schema } from "@/db";
import { and, eq, lte, gte } from "drizzle-orm";

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

/** Theme color tokens for each festival theme. */
export const FESTIVAL_THEMES: Record<
  string,
  { primary: string; accent: string; bg: string; bgEnd: string; text: string }
> = {
  gold: {
    primary: "#A98238",
    accent: "#F7F0E4",
    bg: "#3F4827",
    bgEnd: "#51462F",
    text: "#F7F0E4",
  },
  "festive-red": {
    primary: "#C23B22",
    accent: "#FFE4D6",
    bg: "#8B1A1A",
    bgEnd: "#4A0E0E",
    text: "#FFE4D6",
  },
  "sage-green": {
    primary: "#6A7444",
    accent: "#E8EDD4",
    bg: "#3F4827",
    bgEnd: "#2D3618",
    text: "#E8EDD4",
  },
  midnight: {
    primary: "#7C83FF",
    accent: "#E0D6FF",
    bg: "#1A1A2E",
    bgEnd: "#0F3460",
    text: "#E0D6FF",
  },
};
