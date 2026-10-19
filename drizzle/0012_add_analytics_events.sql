CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "page_url" text,
  "message" text,
  "stack" text,
  "user_agent" text,
  "customer_id" text,
  "meta" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
