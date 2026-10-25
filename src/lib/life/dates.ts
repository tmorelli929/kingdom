// Dates are plain "YYYY-MM-DD" strings in the user's own time zone. A week is named by its Monday.
const pad = (n: number) => String(n).padStart(2, "0");

export const dkey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (k: string, n: number) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dkey(d);
};
export const weekOf = (k: string) => {
  const d = parseKey(k);
  return addDays(k, -((d.getDay() + 6) % 7));
};
export const weekDays = (wk: string) => Array.from({ length: 7 }, (_, i) => addDays(wk, i));
export const daysBetween = (a: string, b: string) => Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86400000);
export const monthOf = (k: string) => k.slice(0, 7);

// "Today" for a given IANA time zone, e.g. America/New_York.
export function todayIn(tz?: string, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return dkey(now);
  }
}
export function timeIn(tz?: string, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz || "UTC", weekday: "long", hour: "numeric", minute: "2-digit" }).format(now);
  } catch {
    return now.toISOString();
  }
}

export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const fmtShort = (k: string) => parseKey(k).toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const fmtLong = (k: string) => parseKey(k).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
