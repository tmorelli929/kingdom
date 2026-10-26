ALTER TABLE "connections" ADD COLUMN "calendars" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "last_synced_at" timestamp with time zone;