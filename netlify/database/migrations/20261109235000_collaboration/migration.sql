ALTER TABLE "endpoints" ADD COLUMN "published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "endpoint_shares" (
  "endpoint_id" text NOT NULL,
  "email" text NOT NULL,
  "role" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "endpoint_shares_endpoint_id_email_pk" PRIMARY KEY("endpoint_id","email")
);--> statement-breakpoint
ALTER TABLE "endpoint_shares" ADD CONSTRAINT "endpoint_shares_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "endpoint_shares_email_idx" ON "endpoint_shares" ("email");--> statement-breakpoint
CREATE TABLE "endpoint_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "endpoint_id" text NOT NULL,
  "actor_email" text NOT NULL,
  "summary" text NOT NULL,
  "mock_spec" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "endpoint_versions" ADD CONSTRAINT "endpoint_versions_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "endpoint_versions_endpoint_idx" ON "endpoint_versions" ("endpoint_id", "created_at");--> statement-breakpoint
CREATE TABLE "audit_events" (
  "id" text PRIMARY KEY NOT NULL,
  "actor_email" text NOT NULL,
  "action" text NOT NULL,
  "endpoint_id" text,
  "detail" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "audit_events_created_idx" ON "audit_events" ("created_at");
