import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
