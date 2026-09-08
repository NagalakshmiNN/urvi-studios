ALTER TABLE "orders" ADD COLUMN "fulfilment_method" text DEFAULT 'delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_mode" text;
