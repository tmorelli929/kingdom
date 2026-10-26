import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { accessToken, CalendarExpired, disconnect, getConnection, type Connection } from "@/lib/google-calendar";

export const GMAIL = "gmail";
// Metadata only: Google lets Kingdom see message headers and labels, never bodies or attachments.
// Kingdom asks for just From, To, Cc and Date, not even subjects.
const METADATA_SCOPE = "https://www.googleapis.com/auth/gmail.metadata";
export const GMAIL_SCOPES = ["openid", "email", METADATA_SCOPE];
export const hasGmailScope = (scopes: string[]) => scopes.some((s) => s.endsWith("/gmail.metadata"));

// Work accounts are never connected (Cisco data stays out of Kingdom).
export const isWorkAccount = (email: string) => /@(.+\.)?cisco\.com$/i.test(email);

const FIRST_SYNC_DAYS = 180;
const MAX_MESSAGES = 600; // per sync; newest first, so the latest contact is always seen
const PARALLEL = 8; // stays under Gmail's per-user rate limit
const STALE_MS = 60 * 60 * 1000;

export const getGmail = (userId: string) => getConnection(userId, GMAIL);

const EMAIL_RE = /[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
export const addresses = (header: string) => (header.match(EMAIL_RE) ?? []).map((a) => a.toLowerCase());

type Msg = { id: string; internalDate?: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } };

// One message's contact: who it was with and which way it went, from headers alone.
export function contactOf(m: Msg, me: string) {
  const h = (n: string) => m.payload?.headers?.filter((x) => x.name.toLowerCase() === n).map((x) => x.value).join(", ") ?? "";
  const from = addresses(h("from"));
  const sent = (m.labelIds ?? []).includes("SENT") || from.includes(me);
  const other = sent ? [...addresses(h("to")), ...addresses(h("cc"))] : from;
  return { at: Number(m.internalDate ?? 0), dir: (sent ? "sent" : "received") as "sent" | "received", with: other.filter((a) => a !== me) };
}

// Local calendar date of an instant in his time zone.
const localDate = (ms: number, tz: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));

async function gmail<T>(c: Connection, token: string, path: string, params: Record<string, string | string[]>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) for (const x of [v].flat()) q.append(k, x);
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}?${q}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (res.status === 401) {
    await db.update(schema.connections).set({ status: "expired", accessToken: null }).where(eq(schema.connections.id, c.id));
    throw new CalendarExpired("Gmail access was removed. Reconnect it in Settings.");
  }
  if (!res.ok) throw new Error(`Gmail returned an error (${res.status}).`);
  return (await res.json()) as T;
}

export type SyncResult = { scanned: number; updated: number; skipped?: "fresh" | "no-emails" };

// Updates "last emailed" for people in his network whose email address appears in recent mail.
// Only newer mail than last time is read. Addresses of people not in his network are never stored.
export async function syncGmail(c: Connection, tz: string, opts: { ifStale?: boolean } = {}): Promise<SyncResult> {
  if (opts.ifStale && c.lastSyncedAt && Date.now() - c.lastSyncedAt.getTime() < STALE_MS) return { scanned: 0, updated: 0, skipped: "fresh" };
  const people = await db.select({ id: schema.people.id, email: schema.people.email, lastEmailOn: schema.people.lastEmailOn })
    .from(schema.people).where(eq(schema.people.userId, c.userId));
  const byAddr = new Map<string, string[]>();
  for (const p of people) for (const a of addresses(p.email)) byAddr.set(a, [...(byAddr.get(a) ?? []), p.id]);
  if (!byAddr.size) {
    await db.update(schema.connections).set({ lastSyncedAt: new Date() }).where(eq(schema.connections.id, c.id));
    return { scanned: 0, updated: 0, skipped: "no-emails" };
  }

  const token = await accessToken(c);
  const since = c.cursor ? Number(c.cursor) : Date.now() - FIRST_SYNC_DAYS * 86400000;
  const me = c.accountEmail.toLowerCase();
  const latest = new Map<string, { on: string; dir: "sent" | "received"; at: number }>();
  let newest = since, scanned = 0, pageToken = "", done = false;

  while (!done && scanned < MAX_MESSAGES) {
    const params: Record<string, string> = { maxResults: "100" };
    if (pageToken) params.pageToken = pageToken;
    const page = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(c, token, "messages", params);
    const ids = (page.messages ?? []).map((m) => m.id);
    for (let i = 0; i < ids.length && !done; i += PARALLEL) {
      const batch = await Promise.all(ids.slice(i, i + PARALLEL).map((id) =>
        gmail<Msg>(c, token, `messages/${id}`, { format: "metadata", metadataHeaders: ["From", "To", "Cc"], fields: "id,internalDate,labelIds,payload/headers" })));
      for (const m of batch) {
        scanned++;
        const ct = contactOf(m, me);
        if (ct.at <= since) { done = true; continue; } // list is newest first; the rest was read last time
        newest = Math.max(newest, ct.at);
        for (const a of ct.with) for (const pid of byAddr.get(a) ?? []) {
          const cur = latest.get(pid);
          if (!cur || ct.at > cur.at) latest.set(pid, { on: localDate(ct.at, tz), dir: ct.dir, at: ct.at });
        }
      }
    }
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }

  let updated = 0;
  for (const [pid, v] of latest) {
    const rows = await db.update(schema.people).set({ lastEmailOn: v.on, lastEmailDir: v.dir })
      .where(and(eq(schema.people.id, pid), eq(schema.people.userId, c.userId), or(isNull(schema.people.lastEmailOn), lt(schema.people.lastEmailOn, v.on))))
      .returning({ id: schema.people.id });
    updated += rows.length;
  }
  await db.update(schema.connections).set({ cursor: String(newest), lastSyncedAt: new Date() }).where(eq(schema.connections.id, c.id));
  return { scanned, updated };
}

// Revokes Gmail access, deletes the tokens, and clears every date that came from Gmail.
export async function disconnectGmail(c: Connection) {
  await disconnect(c);
  await db.update(schema.people).set({ lastEmailOn: null, lastEmailDir: null }).where(eq(schema.people.userId, c.userId));
}
