-- Mascot messages: speech bubble text + animation type
CREATE TABLE IF NOT EXISTS "mascot_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message" text NOT NULL,
  "animation" text DEFAULT 'wave' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
-- Seed default mascot settings
INSERT INTO "site_settings" ("key", "value") VALUES
  ('mascot_enabled', 'true'),
  ('mascot_image_a', '/mascots/mascot-ivory.png'),
  ('mascot_image_b', '/mascots/mascot-mustard.png')
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Seed default messages
INSERT INTO "mascot_messages" ("message", "animation", "sort_order") VALUES
  ('Namaste! 🙏', 'namaste', 1),
  ('Hi!', 'wave', 2),
  ('Hey there!', 'wave', 3),
  ('How are you doing today?', 'wave', 4),
  ('Having a good day?', 'namaste', 5),
  ('I''m thinking of seeing new arrivals!', 'jump', 6),
  ('Have you seen the new arrivals?', 'twirl', 7),
  ('I want something to wear to office!', 'dance', 8),
  ('I want something light to wear...', 'sit', 9),
  ('Something breezy for today?', 'twirl', 10),
  ('I heard there is some offer going on!', 'jump', 11),
  ('Yes it''s true! Check it out!', 'dance', 12),
  ('Psst… there''s a sale!', 'jump', 13),
  ('How about movie night today?', 'dance', 14),
  ('What are your plans tonight?', 'sit', 15),
  ('Feeling fabulous today!', 'twirl', 16),
  ('Ooosh!', 'jump', 17),
  ('Welcome to URVI Studios!', 'namaste', 18);
