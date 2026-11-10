ALTER TABLE "captured_requests" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "health_buckets" (
	"hour" timestamp with time zone NOT NULL,
	"kind" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "health_buckets_pkey" PRIMARY KEY("hour","kind")
);--> statement-breakpoint
CREATE TABLE "recent_errors" (
	"id" text PRIMARY KEY,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "invites" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"status" text NOT NULL,
	"invited_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "invites_email_domain" CHECK ("email" ~ '^[^@]+@paloaltonetworks\.com$'),
	CONSTRAINT "invites_status" CHECK ("status" in ('pending', 'accepted', 'revoked'))
);--> statement-breakpoint
CREATE INDEX "invites_email_idx" ON "invites" ("email");--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY,
	"value" text NOT NULL
);--> statement-breakpoint
INSERT INTO "app_settings" ("key", "value") VALUES ('invite_only', 'false');
