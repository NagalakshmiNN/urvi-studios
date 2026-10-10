CREATE TABLE IF NOT EXISTS "warehouses" (
  "id" text PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "contact_name" text NOT NULL,
  "contact_phone" text NOT NULL,
  "address_line1" text NOT NULL,
  "address_line2" text DEFAULT '',
  "city" text NOT NULL,
  "state" text NOT NULL,
  "pincode" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL
);
