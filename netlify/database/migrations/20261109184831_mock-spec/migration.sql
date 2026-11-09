ALTER TABLE "captured_requests" ADD COLUMN "response_preview" text;--> statement-breakpoint
ALTER TABLE "captured_requests" ADD COLUMN "chaos_effects" jsonb;--> statement-breakpoint
ALTER TABLE "captured_requests" ADD COLUMN "record_count" integer;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "mock_spec" jsonb;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "mock_request_count" integer DEFAULT 0 NOT NULL;