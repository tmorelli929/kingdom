// The dashboard document. Same shape as V1 (v: 1) with a few V2 additions (v: 2).
export type Area = {
  id: string;
  name: string;
  icon: string;
  color: string;
  noScore?: boolean;
  vision: string;
  practices: string;
};
// days: weekdays it applies to (0 = Sunday). Missing means every day.
// match: words that tie it to calendar blocks (comma-separated; empty means its name).
export type Habit = { id: string; name: string; areaId: string; xp: number; days?: number[]; match?: string };
export type Goal = { id: string; week: string; title: string; areaId: string; target: number; count: number };
export type Milestone = { id: string; areaId: string; title: string; done: boolean };
export type Priority = { t: string; d: boolean };
// read.scripture: the chapter of his reading plan he read that day. skipped: habits he chose to skip that day.
// verse: the verse he picked from that day's reading as his verse of the day.
export type Day = { intention: string; priorities: Priority[]; done: Record<string, boolean>; read?: Record<string, string>; skipped?: Record<string, boolean>; verse?: { ref: string; text: string } };
export type AreaReflection = { rating?: number | null; note?: string };
export type Reflection = { areas: Record<string, AreaReflection>; done?: boolean; wins?: string; next?: string };

// Relationship-building goals counted automatically from the Network tab.
export type NetworkMetric = "new_people" | "conversations" | "mentor_conversations" | "reconnects" | "events" | "commitments_kept";
export type NetworkGoal = { id: string; title: string; metric: NetworkMetric; target: number; period: "week" | "month"; areaId: string };

export type CoachAccess = { reflections: boolean; network: boolean; profile: boolean; calendar?: boolean };

// Book-by-book scripture plan. finished: the last chapter of the book has been read.
export type Reading = { book: string; chapter: number; startedOn: string; finished?: boolean };

export type LifeDoc = {
  v: 2;
  name: string;
  protocol: string;
  scripture: string;
  about: string; // personal context the coach may use
  principles: [string, string][];
  areas: Area[];
  habits: Habit[];
  goals: Goal[];
  milestones: Milestone[];
  days: Record<string, Day>;
  reflections: Record<string, Reflection>;
  schedule: Record<string, string>;
  startedOn: string;
  networkCategories: string[];
  reading?: Reading; // scripture reading plan, one chapter a day
  newsTopics?: string[]; // what the daily news brief covers
  newsLocation?: string;
  newsAbout?: string;
  networkGoals: NetworkGoal[];
  coachAccess: CoachAccess;
  [extra: string]: unknown; // unknown V1 fields are kept, never dropped
};
