ALTER TABLE "api_tokens" ADD COLUMN "scopes" text DEFAULT 'mocks:read,mocks:write' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "api_tokens" SET "expires_at" = "created_at" + interval '90 days' WHERE "expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "api_tokens" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "integration_id" text;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "integration_version" text;--> statement-breakpoint
CREATE UNIQUE INDEX "endpoints_user_integration_idx" ON "endpoints" ("user_id", "integration_id", "integration_version") WHERE "integration_id" IS NOT NULL AND "integration_version" IS NOT NULL;
