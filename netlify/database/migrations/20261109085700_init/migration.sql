CREATE TYPE "role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "captured_requests" (
	"id" text PRIMARY KEY,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status" integer DEFAULT 200 NOT NULL,
	"ip" text,
	"user_agent" text,
	"headers" jsonb NOT NULL,
	"body" jsonb,
	"query" jsonb,
	"truncated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"endpoint_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "endpoints" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"path" text NOT NULL UNIQUE,
	"url" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mock_enabled" boolean DEFAULT false NOT NULL,
	"mock_status_code" integer,
	"mock_headers" jsonb,
	"mock_body" text,
	"mock_delay" integer DEFAULT 0 NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_challenges" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"code_salt" text NOT NULL,
	"code_hash" text NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"role" "role" DEFAULT 'USER'::"role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login" timestamp with time zone,
	CONSTRAINT "users_email_domain" CHECK ("email" ~ '^[^@]+@paloaltonetworks\.com$')
);
--> statement-breakpoint
CREATE INDEX "captured_requests_endpoint_created_idx" ON "captured_requests" ("endpoint_id","created_at");--> statement-breakpoint
CREATE INDEX "captured_requests_user_created_idx" ON "captured_requests" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "captured_requests_created_idx" ON "captured_requests" ("created_at");--> statement-breakpoint
CREATE INDEX "endpoints_user_idx" ON "endpoints" ("user_id");--> statement-breakpoint
CREATE INDEX "login_challenges_email_idx" ON "login_challenges" ("email");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" ("user_id");--> statement-breakpoint
ALTER TABLE "captured_requests" ADD CONSTRAINT "captured_requests_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "captured_requests" ADD CONSTRAINT "captured_requests_endpoint_id_endpoints_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "endpoints"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;