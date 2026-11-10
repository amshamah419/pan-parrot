ALTER TABLE "endpoints" ADD COLUMN "notify_first_catch" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "first_catch_at" timestamp with time zone;
