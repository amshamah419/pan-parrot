CREATE TABLE "endpoint_runtime" (
  "endpoint_id" text PRIMARY KEY NOT NULL,
  "records" jsonb NOT NULL,
  "seen_ids" jsonb NOT NULL,
  "scenario_index" integer DEFAULT 0 NOT NULL,
  "fetch_cursor" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "endpoint_runtime" ADD CONSTRAINT "endpoint_runtime_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;
