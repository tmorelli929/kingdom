import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { LIBRARY, type PlanItem } from "@/lib/fitness/library";
import { PROGRAM_ID, programDays } from "@/lib/fitness/program";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type Exercise = Omit<typeof schema.exercises.$inferSelect, "userId" | "createdAt">;
export type PlanSlot = PlanItem & { swappedFrom?: string };
export type Workout = {
  id: string; date: string; kind: "lift" | "recovery"; templateCode: string | null; title: string; focus: string;
  plan: PlanSlot[]; status: "planned" | "in_progress" | "completed" | "skipped"; note: string; notes: string;
  cardioMin: number; cardioMax: number; cardioOptions: string[]; cardioMinutes: number | null; cardioEquipment: string | null; cardioDone: boolean;
  startedAt: string | null; finishedAt: string | null; originalDate: string | null;
};
export type SetRow = { workoutId: string; slot: number; setNumber: number; exerciseKey: string; weight: number | null; reps: number | null; done: boolean };
export type FitnessData = {
  settings: { unit: string; restTimer: boolean };
  exercises: Exercise[];
  workouts: Workout[];
  sets: SetRow[];
  bodyWeights: { date: string; weight: number }[];
};

// Creates his settings, the exercise library and the dated program the first time. Running it again
// changes nothing: library rows and seeded days are keyed, and a program is only seeded once even if
// he later deletes or moves days.
export async function ensureFitness(userId: string) {
  await db.transaction(async (tx) => {
    await tx.insert(schema.fitnessSettings).values({ userId }).onConflictDoNothing();
    await tx.insert(schema.exercises).values(LIBRARY.map((e) => ({
      userId, key: e.key, name: e.name, muscle: e.muscle, equipment: e.equipment, pattern: e.pattern, type: e.type,
      increment: e.increment, caution: e.caution ?? "",
    }))).onConflictDoNothing();
    const [s] = await tx.select().from(schema.fitnessSettings).where(eq(schema.fitnessSettings.userId, userId)).for("update");
    if (s.seededPrograms.includes(PROGRAM_ID)) return;
    await tx.insert(schema.workouts).values(programDays().map((d) => ({
      userId, date: d.date, kind: d.kind, templateCode: d.templateCode, title: d.title, focus: d.focus, plan: d.plan, note: d.note,
      cardioMin: d.cardio.min, cardioMax: d.cardio.max, cardioOptions: d.cardio.options, seedKey: d.seedKey, originalDate: d.date,
    }))).onConflictDoNothing();
    await tx.update(schema.fitnessSettings).set({ seededPrograms: sql`array_append(${schema.fitnessSettings.seededPrograms}, ${PROGRAM_ID})` }).where(eq(schema.fitnessSettings.userId, userId));
  });
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function loadFitness(userId: string): Promise<FitnessData> {
  const [settings] = await db.select().from(schema.fitnessSettings).where(eq(schema.fitnessSettings.userId, userId));
  const [ex, wo, sets, bw] = await Promise.all([
    db.select().from(schema.exercises).where(eq(schema.exercises.userId, userId)).orderBy(asc(schema.exercises.createdAt), asc(schema.exercises.name)),
    db.select().from(schema.workouts).where(eq(schema.workouts.userId, userId)).orderBy(asc(schema.workouts.date), asc(schema.workouts.createdAt)),
    db.select().from(schema.workoutSets).where(eq(schema.workoutSets.userId, userId)),
    db.select().from(schema.bodyWeights).where(eq(schema.bodyWeights.userId, userId)).orderBy(asc(schema.bodyWeights.date)),
  ]);
  return {
    settings: { unit: settings?.unit ?? "lb", restTimer: settings?.restTimer ?? true },
    exercises: ex.map(({ userId: _u, createdAt: _c, ...e }) => e),
    workouts: wo.map((w) => ({
      id: w.id, date: w.date, kind: w.kind as Workout["kind"], templateCode: w.templateCode, title: w.title, focus: w.focus,
      plan: w.plan as PlanSlot[], status: w.status as Workout["status"], note: w.note, notes: w.notes,
      cardioMin: w.cardioMin, cardioMax: w.cardioMax, cardioOptions: w.cardioOptions, cardioMinutes: w.cardioMinutes, cardioEquipment: w.cardioEquipment, cardioDone: w.cardioDone,
      startedAt: iso(w.startedAt), finishedAt: iso(w.finishedAt), originalDate: w.originalDate,
    })),
    sets: sets.map((s) => ({ workoutId: s.workoutId, slot: s.slot, setNumber: s.setNumber, exerciseKey: s.exerciseKey, weight: s.weight, reps: s.reps, done: s.done })),
    bodyWeights: bw.map((b) => ({ date: b.date, weight: b.weight })),
  };
}

const planSlot = z.object({
  key: z.string().min(1).max(80), sets: z.number().int().min(1).max(10), repLow: z.number().int().min(1).max(100),
  repHigh: z.number().int().min(1).max(100), rest: z.number().int().min(0).max(600), swappedFrom: z.string().max(80).optional(),
});

export const workoutPatch = z.object({
  action: z.enum(["start", "finish", "skip", "reopen"]).optional(),
  date: dateKey.optional(),
  notes: z.string().max(5000).optional(),
  plan: z.array(planSlot).max(20).optional(),
  cardioMinutes: z.number().int().min(0).max(300).nullable().optional(),
  cardioEquipment: z.string().max(80).nullable().optional(),
  cardioDone: z.boolean().optional(),
});

export async function patchWorkout(userId: string, id: string, p: z.infer<typeof workoutPatch>) {
  if (!isUuid(id)) return null;
  const set: Record<string, unknown> = {};
  if (p.date) set.date = p.date;
  if (p.notes !== undefined) set.notes = p.notes;
  if (p.plan) set.plan = p.plan;
  if (p.cardioMinutes !== undefined) set.cardioMinutes = p.cardioMinutes;
  if (p.cardioEquipment !== undefined) set.cardioEquipment = p.cardioEquipment;
  if (p.cardioDone !== undefined) set.cardioDone = p.cardioDone;
  if (p.action === "start") { set.status = "in_progress"; set.startedAt = sql`coalesce(${schema.workouts.startedAt}, now())`; }
  if (p.action === "finish") { set.status = "completed"; set.finishedAt = new Date(); }
  if (p.action === "skip") set.status = "skipped";
  if (p.action === "reopen") { set.status = "planned"; set.finishedAt = null; }
  if (!Object.keys(set).length) return null;
  const [row] = await db.update(schema.workouts).set(set as Partial<typeof schema.workouts.$inferInsert>).where(and(eq(schema.workouts.id, id), eq(schema.workouts.userId, userId))).returning({ id: schema.workouts.id });
  return row ?? null;
}

export const setInput = z.object({
  workoutId: z.string().uuid(),
  slot: z.number().int().min(0).max(19),
  setNumber: z.number().int().min(1).max(10),
  exerciseKey: z.string().min(1).max(80),
  weight: z.number().min(0).max(2000).nullable(),
  reps: z.number().int().min(0).max(200).nullable(),
  done: z.boolean(),
});

export async function saveSet(userId: string, s: z.infer<typeof setInput>) {
  const [w] = await db.select({ id: schema.workouts.id }).from(schema.workouts).where(and(eq(schema.workouts.id, s.workoutId), eq(schema.workouts.userId, userId))).limit(1);
  if (!w) return false;
  const values = { ...s, userId, updatedAt: new Date() };
  await db.insert(schema.workoutSets).values(values).onConflictDoUpdate({
    target: [schema.workoutSets.workoutId, schema.workoutSets.slot, schema.workoutSets.setNumber],
    set: { exerciseKey: s.exerciseKey, weight: s.weight, reps: s.reps, done: s.done, updatedAt: new Date() },
  });
  return true;
}

export const exerciseInput = z.object({
  name: z.string().trim().min(1).max(120),
  muscle: z.string().max(40),
  equipment: z.string().max(60),
  equipmentDetail: z.string().trim().max(200).default(""),
  pattern: z.string().trim().max(60).default(""),
  type: z.string().max(40).default(""),
  increment: z.number().min(0).max(100).default(5),
});
export const exercisePatch = exerciseInput.partial().extend({ availability: z.enum(["unknown", "available", "unavailable"]).optional(), caution: z.string().max(400).optional() });
