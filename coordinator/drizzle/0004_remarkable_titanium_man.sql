ALTER TABLE "workers" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "device_model" text;--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "last_seen_at" timestamp with time zone;