CREATE TABLE "suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"ord" integer NOT NULL,
	"person_name" text NOT NULL,
	"person_id" uuid,
	"occurred_on" date NOT NULL,
	"kind" text DEFAULT 'conversation' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"follow_up" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "digest_label" text;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "digest_cursor" text;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "suggestions_source_idx" ON "suggestions" USING btree ("user_id","source","source_id","ord");--> statement-breakpoint
CREATE INDEX "suggestions_user_status_idx" ON "suggestions" USING btree ("user_id","status");