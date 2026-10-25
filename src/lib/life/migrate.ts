import { defaultDoc } from "./defaults";
import type { LifeDoc } from "./types";

export type ImportPreview = {
  areas: number;
  habits: number;
  days: number;
  checkIns: number;
  missions: number;
  milestones: number;
  reflections: number;
  calendarNotes: number;
  coachMessages: number;
  from: string | null;
  to: string | null;
};

export type ParsedImport = {
  doc: LifeDoc;
  chat: { role: "user" | "assistant"; content: string }[];
  preview: ImportPreview;
};

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const isDateKey = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k);

export class ImportError extends Error {}

// Turns a V1 backup (or a V2 export) into a V2 document. Every V1 field is carried across;
// anything V2 doesn't use yet stays on the document untouched.
export function parseBackup(raw: string, today: string): ParsedImport {
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new ImportError("That isn't a Kingdom backup. In V1, open Setup, tap Copy backup, and paste the whole text.");
  }
  // A V2 export wraps the document.
  if (isObj(input) && isObj(input.life)) input = input.life;
  if (!isObj(input) || !Array.isArray(input.areas) || !Array.isArray(input.habits)) {
    throw new ImportError("That backup is missing its life areas or daily quests, so it can't be imported. Copy the whole backup and try again.");
  }
  const src = input;
  const base = defaultDoc(today);
  const doc = { ...src } as Record<string, unknown>;

  // Fill V2 fields that V1 didn't have, without touching anything V1 did have.
  for (const [k, v] of Object.entries(base)) if (doc[k] === undefined) doc[k] = v;
  for (const k of ["goals", "milestones"]) if (!Array.isArray(doc[k])) doc[k] = [];
  for (const k of ["days", "reflections", "schedule"]) if (!isObj(doc[k])) doc[k] = {};
  // V1-only fields that moved elsewhere in V2.
  const chatRaw = Array.isArray(src.chat) ? src.chat : [];
  delete doc.chat;
  delete doc.brief;
  delete doc.updatedAt;

  const days = doc.days as Record<string, unknown>;
  for (const k of Object.keys(days)) if (!isDateKey(k) || !isObj(days[k])) delete days[k];
  for (const d of Object.values(days) as Record<string, unknown>[]) {
    if (!isObj(d.done)) d.done = {};
    if (!Array.isArray(d.priorities)) d.priorities = [];
    while ((d.priorities as unknown[]).length < 3) (d.priorities as unknown[]).push({ t: "", d: false });
    if (typeof d.intention !== "string") d.intention = "";
  }
  const dayKeys = Object.keys(days).sort();
  if (typeof doc.startedOn !== "string" || !isDateKey(doc.startedOn as string)) doc.startedOn = dayKeys[0] ?? today;
  doc.v = 2;

  const chat = chatRaw
    .filter((m): m is { role: string; content: string } => isObj(m) && typeof m.content === "string" && m.content !== "…")
    .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.content.slice(0, 20000) }));

  const life = doc as LifeDoc;
  return {
    doc: life,
    chat,
    preview: {
      areas: life.areas.length,
      habits: life.habits.length,
      days: dayKeys.length,
      checkIns: Object.values(life.days).reduce((n, d) => n + Object.values(d.done || {}).filter(Boolean).length, 0),
      missions: life.goals.length,
      milestones: life.milestones.length,
      reflections: Object.keys(life.reflections).length,
      calendarNotes: Object.values(life.schedule).filter((s) => typeof s === "string" && s.trim()).length,
      coachMessages: chat.length,
      from: dayKeys[0] ?? null,
      to: dayKeys[dayKeys.length - 1] ?? null,
    },
  };
}

// Light structural check on every save so a buggy client can't store a broken document.
export function looksLikeLifeDoc(x: unknown): x is LifeDoc {
  return isObj(x) && x.v === 2 && Array.isArray(x.areas) && Array.isArray(x.habits) && Array.isArray(x.goals) && isObj(x.days) && isObj(x.reflections);
}
