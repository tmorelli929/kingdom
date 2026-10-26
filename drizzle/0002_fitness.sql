CREATE TABLE "body_weights" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"weight" real NOT NULL,
	CONSTRAINT "body_weights_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"muscle" text NOT NULL,
	"equipment" text NOT NULL,
	"equipment_detail" text DEFAULT '' NOT NULL,
	"pattern" text DEFAULT '' NOT NULL,
	"type" text DEFAULT '' NOT NULL,
	"increment" real DEFAULT 5 NOT NULL,
	"caution" text DEFAULT '' NOT NULL,
	"availability" text DEFAULT 'unknown' NOT NULL,
	"custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercises_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "fitness_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"unit" text DEFAULT 'lb' NOT NULL,
	"rest_timer" boolean DEFAULT true NOT NULL,
	"seeded_programs" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workout_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"set_number" integer NOT NULL,
	"exercise_key" text NOT NULL,
	"weight" real,
	"reps" integer,
	"done" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"template_code" text,
	"title" text NOT NULL,
	"focus" text DEFAULT '' NOT NULL,
	"plan" jsonb NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"cardio_min" integer DEFAULT 10 NOT NULL,
	"cardio_max" integer DEFAULT 15 NOT NULL,
	"cardio_options" text[] DEFAULT '{}'::text[] NOT NULL,
	"cardio_minutes" integer,
	"cardio_equipment" text,
	"cardio_done" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"seed_key" text,
	"original_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "body_weights" ADD CONSTRAINT "body_weights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_settings" ADD CONSTRAINT "fitness_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workout_sets_slot_idx" ON "workout_sets" USING btree ("workout_id","slot","set_number");--> statement-breakpoint
CREATE INDEX "workout_sets_ex_idx" ON "workout_sets" USING btree ("user_id","exercise_key");--> statement-breakpoint
CREATE INDEX "workouts_user_date_idx" ON "workouts" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "workouts_seed_idx" ON "workouts" USING btree ("user_id","seed_key");