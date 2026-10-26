import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleSub: text("google_sub").unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Only a SHA-256 hash of the session token is stored, so a database leak can't be replayed as a login.
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// The dashboard (areas, quests, missions, reflections...) as one document per user, same shape as V1.
// `version` goes up on every save; a save based on an older version is refused instead of overwriting.
export const lifeDocs = pgTable("life_docs", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Original V1 backups, kept word for word so nothing V2 doesn't understand yet is lost.
export const imports = pgTable("imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  raw: text("raw").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per Claude API call, with its token counts and estimated cost, so Settings can show what AI features cost.
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    feature: text("feature").notNull(), // "ask" | "insights" | "news" | "digest"
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    searches: integer("searches").notNull().default(0),
    costMicros: integer("cost_micros").notNull().default(0), // millionths of a dollar
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_user_idx").on(t.userId, t.createdAt)],
);

export const coachMessages = pgTable(
  "coach_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // "chat" | "brief"
    role: text("role").notNull(), // "user" | "assistant"
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("coach_messages_user_idx").on(t.userId, t.createdAt)],
);

/* ---------- Network (personal relationships) ---------- */

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    organization: text("organization").notNull().default(""),
    title: text("title").notNull().default(""),
    linkedinUrl: text("linkedin_url").notNull().default(""),
    email: text("email").notNull().default(""),
    location: text("location").notNull().default(""),
    metWhere: text("met_where").notNull().default(""),
    metOn: date("met_on"),
    categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
    notes: text("notes").notNull().default(""),
    interests: text("interests").notNull().default(""),
    nextFollowUp: date("next_follow_up"),
    // Most recent email with this person, from Gmail headers only (no content). Cleared when Gmail is disconnected.
    lastEmailOn: date("last_email_on"),
    lastEmailDir: text("last_email_dir"), // "sent" | "received"
    // When false, the coach never sees this person.
    aiAccess: boolean("ai_access").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("people_user_idx").on(t.userId)],
);

// A conversation, coffee, call or event with someone. A future date means it's planned.
export const interactions = pgTable(
  "interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    occurredOn: date("occurred_on").notNull(),
    kind: text("kind").notNull().default("conversation"),
    summary: text("summary").notNull().default(""),
    // Set when this was linked from a calendar event, so the same event isn't suggested again.
    sourceEventId: text("source_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("interactions_user_idx").on(t.userId, t.occurredOn)],
);

// Things I said I'd do for someone.
export const commitments = pgTable(
  "commitments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    dueOn: date("due_on"),
    doneOn: date("done_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("commitments_user_idx").on(t.userId)],
);

/* ---------- Connections (Google Calendar now, Gmail later) ---------- */

// One row per connected account. Tokens are encrypted with AES-256-GCM before they reach the database.
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "google_calendar" | "gmail"
    accountEmail: text("account_email").notNull().default(""),
    scope: text("scope").notNull().default(""),
    refreshToken: text("refresh_token").notNull(),
    accessToken: text("access_token"),
    accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }),
    status: text("status").notNull().default("ok"), // "ok" | "expired"
    // Calendar events he said aren't about anyone in his network.
    dismissed: text("dismissed").array().notNull().default(sql`'{}'::text[]`),
    // His Google calendars and which ones Kingdom reads: [{ id, name, color, primary, selected }].
    calendars: jsonb("calendars").notNull().default(sql`'[]'::jsonb`),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    // Gmail: newest message time (ms) already scanned, so each sync only reads newer mail.
    cursor: text("cursor"),
    // Gmail daily digest: the label to read (only messages under it are ever opened) and the newest one handled (ms).
    digestLabel: text("digest_label"),
    digestCursor: text("digest_cursor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("connections_user_provider_idx").on(t.userId, t.provider)],
);

// Network updates proposed from his daily digest email. Nothing is applied until he approves it.
// The email itself is never stored; only these extracted lines are.
export const suggestions = pgTable(
  "suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    source: text("source").notNull(), // "digest"
    sourceId: text("source_id").notNull(), // Gmail message id
    ord: integer("ord").notNull(),
    personName: text("person_name").notNull(),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    occurredOn: date("occurred_on").notNull(),
    kind: text("kind").notNull().default("conversation"),
    summary: text("summary").notNull().default(""),
    followUp: text("follow_up").notNull().default(""),
    status: text("status").notNull().default("pending"), // pending | applied | dismissed
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("suggestions_source_idx").on(t.userId, t.source, t.sourceId, t.ord), index("suggestions_user_status_idx").on(t.userId, t.status)],
);

/* ---------- Fitness ---------- */

// His exercise library: the defaults plus his own. `key` is stable so plans and logs can refer to it.
export const exercises = pgTable(
  "exercises",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    muscle: text("muscle").notNull(),
    equipment: text("equipment").notNull(),
    // The exact machine at his gym, e.g. "Technogym Selection 900 Chest Press, station 4".
    equipmentDetail: text("equipment_detail").notNull().default(""),
    pattern: text("pattern").notNull().default(""),
    type: text("type").notNull().default(""),
    increment: real("increment").notNull().default(5),
    caution: text("caution").notNull().default(""),
    // "unknown" until he confirms his gym has it.
    availability: text("availability").notNull().default("unknown"), // "unknown" | "available" | "unavailable"
    custom: boolean("custom").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

export const fitnessSettings = pgTable("fitness_settings", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  unit: text("unit").notNull().default("lb"),
  restTimer: boolean("rest_timer").notNull().default(true),
  seededPrograms: text("seeded_programs").array().notNull().default(sql`'{}'::text[]`),
});

// One dated session, planned or done. `plan` is this day's own copy of the exercises, so changing
// a template never rewrites history, and a substitution only affects this session.
export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    kind: text("kind").notNull(), // "lift" | "recovery"
    templateCode: text("template_code"),
    title: text("title").notNull(),
    focus: text("focus").notNull().default(""),
    plan: jsonb("plan").notNull(), // PlanItem[] (+ swappedFrom)
    status: text("status").notNull().default("planned"), // "planned" | "in_progress" | "completed" | "skipped"
    note: text("note").notNull().default(""),
    notes: text("notes").notNull().default(""),
    cardioMin: integer("cardio_min").notNull().default(10),
    cardioMax: integer("cardio_max").notNull().default(15),
    cardioOptions: text("cardio_options").array().notNull().default(sql`'{}'::text[]`),
    cardioMinutes: integer("cardio_minutes"),
    cardioEquipment: text("cardio_equipment"),
    cardioDone: boolean("cardio_done").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    // Where seeding put it; stays the same if he moves the session, so re-seeding never duplicates it.
    seedKey: text("seed_key"),
    originalDate: date("original_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("workouts_user_date_idx").on(t.userId, t.date), uniqueIndex("workouts_seed_idx").on(t.userId, t.seedKey)],
);

// One set. `slot` is the exercise's position in the session's plan.
export const workoutSets = pgTable(
  "workout_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    workoutId: uuid("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    setNumber: integer("set_number").notNull(),
    exerciseKey: text("exercise_key").notNull(),
    weight: real("weight"),
    reps: integer("reps"),
    done: boolean("done").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("workout_sets_slot_idx").on(t.workoutId, t.slot, t.setNumber), index("workout_sets_ex_idx").on(t.userId, t.exerciseKey)],
);

export const bodyWeights = pgTable(
  "body_weights",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    weight: real("weight").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);
