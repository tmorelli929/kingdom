import { addDays, parseKey } from "../life/dates";
import { LIBRARY, RECOVERY_CARDIO, TEMPLATES, type PlanItem } from "./library";

// The fall 2026 block: Push/Pull/Legs twice a week, Sunday recovery, Oct 25 to Nov 30.
export const PROGRAM_ID = "ppl-fall-2026";
export const PROGRAM_START = "2026-10-25";
export const PROGRAM_END = "2026-11-30";
// Monday..Saturday, by JavaScript getDay() (0 = Sunday).
const BY_WEEKDAY: Record<number, string> = { 1: "push_a", 2: "pull_a", 3: "legs_a", 4: "push_b", 5: "pull_b", 6: "legs_b" };

export type ProgramDay = {
  seedKey: string; // stable per program and original date, so seeding twice never duplicates
  date: string;
  kind: "lift" | "recovery";
  templateCode: string | null;
  title: string;
  focus: string;
  plan: PlanItem[];
  cardio: { min: number; max: number; options: string[] };
  note: string;
};

export function programDays(start = PROGRAM_START, end = PROGRAM_END): ProgramDay[] {
  const out: ProgramDay[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const code = BY_WEEKDAY[parseKey(d).getDay()];
    const t = code ? TEMPLATES.find((x) => x.code === code)! : null;
    const thanksgiving = d >= "2026-11-26" && d <= "2026-11-28";
    out.push({
      seedKey: `${PROGRAM_ID}:${d}`,
      date: d,
      kind: t ? "lift" : "recovery",
      templateCode: t?.code ?? null,
      title: t ? t.name : "Recovery",
      focus: t ? t.focus : "Light cardio, optional",
      plan: t ? t.items.map((i) => ({ ...i })) : [],
      cardio: t ? { ...t.cardio } : { ...RECOVERY_CARDIO },
      note: thanksgiving ? "Thanksgiving week: if you're traveling or the gym is closed, move this day, swap exercises for what's available, or skip it." : "",
    });
  }
  return out;
}

// Rough session length: each working set plus its rest, a minute to set up each exercise, and the cardio.
export function estimateMinutes(plan: PlanItem[], cardioMax: number) {
  const seconds = plan.reduce((s, i) => s + i.sets * (40 + i.rest) + 60, 0);
  return Math.round(seconds / 60 + cardioMax);
}

export const exerciseByKey = new Map(LIBRARY.map((e) => [e.key, e]));
