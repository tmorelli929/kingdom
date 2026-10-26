import type { Person } from "@/lib/life/network";

// LinkedIn's data export (Settings > Data privacy > Get a copy of your data > Connections) gives a
// Connections.csv: a few lines of notes, then First Name, Last Name, URL, Email Address, Company,
// Position, Connected On. LinkedIn's API doesn't offer connections to personal apps, so this is the way in.

export type LinkedInRow = { name: string; url: string; email: string; company: string; position: string; connectedOn: string | null };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
export function parseConnectedOn(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})$/); // 25 Oct 2026
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return t;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); // 10/25/26
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

export function parseConnections(text: string): LinkedInRow[] {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const h = rows.findIndex((r) => r.map((x) => x.trim().toLowerCase()).includes("first name"));
  if (h < 0) throw new Error("This doesn't look like LinkedIn's Connections.csv (no \"First Name\" column).");
  const cols = rows[h].map((x) => x.trim().toLowerCase());
  const at = (r: string[], name: string) => (cols.indexOf(name) >= 0 ? (r[cols.indexOf(name)] ?? "").trim() : "");
  return rows.slice(h + 1).map((r) => ({
    name: `${at(r, "first name")} ${at(r, "last name")}`.trim(),
    url: at(r, "url"),
    email: at(r, "email address").toLowerCase(),
    company: at(r, "company"),
    position: at(r, "position"),
    connectedOn: parseConnectedOn(at(r, "connected on")),
  })).filter((r) => r.name);
}

export const normUrl = (u: string) => u.trim().toLowerCase().replace(/^http:/, "https:").replace("://linkedin.com", "://www.linkedin.com").replace(/[?#].*$/, "").replace(/\/+$/, "");
const validUrl = (u: string) => /^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(u) && u.length <= 300;
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;

export type Plan = {
  updates: { id: string; name: string; patch: Partial<Pick<Person, "organization" | "title" | "linkedinUrl" | "email">> }[];
  adds: { name: string; organization: string; title: string; linkedinUrl: string; email: string; metWhere: string; metOn: string | null }[];
  unchanged: number;
};

// Matches each connection to someone already in his network (LinkedIn URL, then email, then a unique
// exact name). Existing people only get blank fields filled in; nothing he wrote is overwritten.
export function planImport(rows: LinkedInRow[], people: Pick<Person, "id" | "name" | "organization" | "title" | "linkedinUrl" | "email">[]): Plan {
  const byUrl = new Map(people.filter((p) => p.linkedinUrl).map((p) => [normUrl(p.linkedinUrl), p]));
  const byEmail = new Map(people.filter((p) => p.email).map((p) => [p.email.toLowerCase(), p]));
  const byName = new Map<string, typeof people>();
  for (const p of people) { const k = p.name.trim().toLowerCase(); byName.set(k, [...(byName.get(k) ?? []), p]); }
  const plan: Plan = { updates: [], adds: [], unchanged: 0 };
  const seen = new Set<string>();
  for (const r of rows) {
    const url = validUrl(r.url) ? r.url.trim() : "";
    const email = validEmail(r.email) ? r.email : "";
    const named = byName.get(r.name.toLowerCase());
    const match = (url && byUrl.get(normUrl(url))) || (email && byEmail.get(email)) || (named?.length === 1 ? named[0] : undefined);
    if (match) {
      if (seen.has(match.id)) continue;
      seen.add(match.id);
      const patch: Plan["updates"][number]["patch"] = {};
      if (!match.organization && r.company) patch.organization = r.company.slice(0, 160);
      if (!match.title && r.position) patch.title = r.position.slice(0, 160);
      if (!match.linkedinUrl && url) patch.linkedinUrl = url;
      if (!match.email && email) patch.email = email;
      if (Object.keys(patch).length) plan.updates.push({ id: match.id, name: match.name, patch });
      else plan.unchanged++;
    } else {
      const k = url ? normUrl(url) : r.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      plan.adds.push({ name: r.name.slice(0, 120), organization: r.company.slice(0, 160), title: r.position.slice(0, 160), linkedinUrl: url, email, metWhere: "LinkedIn", metOn: r.connectedOn });
    }
  }
  return plan;
}
