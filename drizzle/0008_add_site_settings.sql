CREATE TABLE IF NOT EXISTS "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
INSERT INTO "site_settings" ("key", "value") VALUES ('beta_banner_enabled', 'false') ON CONFLICT DO NOTHING;
