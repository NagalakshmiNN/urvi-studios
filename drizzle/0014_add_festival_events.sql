CREATE TABLE IF NOT EXISTS "festival_events" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "tagline" text,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "theme" text DEFAULT 'gold' NOT NULL,
  "banner_text" text,
  "banner_sub" text,
  "animation" text DEFAULT 'confetti',
  "discount_type" text,
  "discount_value" integer,
  "badge_text" text DEFAULT 'SALE',
  "is_active" boolean DEFAULT true NOT NULL,
  "show_mascot" boolean DEFAULT false NOT NULL,
  "mascot_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "festival_events_slug_unique" ON "festival_events" USING btree ("slug");
