ALTER TABLE "endpoints" ADD COLUMN "lock_token_hash" text;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "lock_cidrs" text;--> statement-breakpoint
CREATE TABLE "auth_strikes" (
	"key" text PRIMARY KEY,
	"failures" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"locked_until" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY,
	"value" text NOT NULL
);--> statement-breakpoint
INSERT INTO "site_settings" ("key", "value") VALUES ('new_mocks_locked', 'false');
