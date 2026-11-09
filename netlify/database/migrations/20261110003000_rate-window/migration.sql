ALTER TABLE "endpoint_runtime" ADD COLUMN "rate_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoint_runtime" ADD COLUMN "rate_window_start" timestamp with time zone;
