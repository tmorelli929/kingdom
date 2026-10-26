"use client";
import { useEffect, useState } from "react";
import { uid } from "@/lib/life/defaults";
import { METRIC_LABEL } from "@/lib/life/network";
import type { NetworkMetric } from "@/lib/life/types";
import { api, tz } from "../api";
import { useApp } from "../App";
import { Icon } from "../ui";
import { ImportCard } from "./Onboarding";

const CAL_RESULT: Record<string, string> = {
  connected: "Google Calendar connected.",
  denied: "Calendar wasn't connected: Kingdom needs the read-only calendar permission. Try again and leave it checked.",
  cancelled: "Calendar connection was cancelled.",
  failed: "Google didn't finish connecting the calendar. Try again.",
};

const GMAIL_RESULT: Record<string, string> = {
  connected: "Gmail connected. Checking recent mail…",
  denied: "Gmail wasn't connected: Kingdom needs the \"view your email message metadata\" permission. Try again and leave it checked.",
  work: "That's a work account, so Kingdom didn't connect it. Use your personal Gmail.",
  cancelled: "Gmail connection was cancelled.",
  failed: "Google didn't finish connecting Gmail. Try again.",
};
const fmtSynced = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type GmailConn = { email: string; status: string; lastSyncedAt: string | null; digest: boolean; digestLabel: string };
type DigestResult = { found: number; suggested: number; problem?: "no-label" | "no-key" | "error" };
type LinkedInPreview = { total: number; update: number; add: number; unchanged: number; sample: string[] };

type CalConn = {
  email: string; status: string; lastSyncedAt: string | null; canList: boolean;
  calendars: { id: string; name: string; color: string; primary: boolean; selected: boolean }[];
};

export default function Setup() {
  const { doc, mutate, replaceDoc, toast, email, reloadNet } = useApp();
  const [newCat, setNewCat] = useState("");
  const [newGoal, setNewGoal] = useState<{ title: string; metric: NetworkMetric; target: number; period: "week" | "month"; areaId: string }>({ title: "", metric: "conversations", target: 1, period: "month", areaId: "career" });
  const [delStep, setDelStep] = useState(0);
  const [delText, setDelText] = useState("");
  const [calConn, setCalConn] = useState<CalConn | null | undefined>(undefined);
  const [gmail, setGmail] = useState<GmailConn | null | undefined>(undefined);
  const [gmailBusy, setGmailBusy] = useState(false);
  const [li, setLi] = useState<{ csv: string; preview: LinkedInPreview } | null>(null);
  const [liBusy, setLiBusy] = useState(false);
  const loadConn = () => api<{ calendar: CalConn | null; gmail: GmailConn | null }>("/api/connections")
    .then((r) => { setCalConn(r.calendar); setGmail(r.gmail); }).catch(() => { setCalConn(null); setGmail(null); });
  const syncGmail = async () => {
    setGmailBusy(true);
    try {
      const r = await api<{ expired?: boolean; scanned: number; updated: number; skipped?: string; digest?: DigestResult }>("/api/connections/gmail/sync", "POST", { tz: tz() });
      const d = r.digest;
      const digestNote = !d || !gmail?.digest ? ""
        : d.problem === "no-label" ? ` No Gmail label named "${gmail.digestLabel}" yet.`
        : d.problem === "no-key" ? " A digest is waiting, but reading it needs the Anthropic key."
        : d.problem === "error" ? " Couldn't read the digest just now; it'll be tried again."
        : d.found ? ` Read ${d.found} digest${d.found === 1 ? "" : "s"}: ${d.suggested} suggested update${d.suggested === 1 ? "" : "s"} are waiting in Network.` : " No new digest.";
      if (r.expired) toast("Gmail access expired. Reconnect it below.");
      else if (r.skipped === "no-emails") toast("None of your network has an email address saved yet, so there was nothing to match." + digestNote);
      else toast(`Checked ${r.scanned} new email${r.scanned === 1 ? "" : "s"}; updated last contact for ${r.updated} ${r.updated === 1 ? "person" : "people"}.` + digestNote);
      await Promise.all([loadConn(), reloadNet()]);
    } catch (e) { toast(e instanceof Error ? e.message : "Gmail sync failed."); }
    finally { setGmailBusy(false); }
  };
  const disconnectGmail = async () => {
    try { await api("/api/connections", "DELETE", { provider: "gmail" }); setGmail(null); await reloadNet(); toast("Gmail disconnected, access revoked, and email dates cleared."); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't disconnect."); }
  };
  const pickLinkedIn = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_900_000) { toast("That file is too large. Export just Connections from LinkedIn."); return; }
    setLiBusy(true);
    try {
      const csv = await file.text();
      setLi({ csv, preview: await api<LinkedInPreview>("/api/import/linkedin", "POST", { csv }) });
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't read that file."); }
    finally { setLiBusy(false); }
  };
  const importLinkedIn = async (addNew: boolean) => {
    if (!li) return;
    setLiBusy(true);
    try {
      const r = await api<{ added: number; updated: number }>("/api/import/linkedin", "POST", { csv: li.csv, apply: true, addNew });
      toast(`LinkedIn import done: ${r.updated} updated${addNew ? `, ${r.added} added` : ""}.`);
      setLi(null);
      await reloadNet();
    } catch (e) { toast(e instanceof Error ? e.message : "Import failed."); }
    finally { setLiBusy(false); }
  };
  const toggleCal = async (id: string, on: boolean) => {
    setCalConn((c) => c && { ...c, calendars: c.calendars.map((x) => (x.id === id ? { ...x, selected: on } : x)) });
    try { await api("/api/connections", "PATCH", { calendars: { [id]: on } }); } catch (e) { toast(e instanceof Error ? e.message : "Not saved."); loadConn(); }
  };
  useEffect(() => {
    loadConn();
    const params = new URLSearchParams(location.search);
    const q = params.get("calendar"), g = params.get("gmail");
    if (q) toast(CAL_RESULT[q] ?? "Calendar connection finished.");
    if (g) toast(GMAIL_RESULT[g] ?? "Gmail connection finished.");
    if (q || g) history.replaceState(null, "", "/#setup");
    if (g === "connected") syncGmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const disconnectCal = async () => {
    try { await api("/api/connections", "DELETE", { provider: "calendar" }); setCalConn(null); toast("Google Calendar disconnected and access revoked."); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't disconnect."); }
  };

  return (
    <>
      <section className="hero single stack-s"><span className="eyebrow">Setup</span><h1>Settings</h1><p className="muted small">Signed in as {email}</p></section>

      <section className="card">
        <div className="card-head"><h2>Connections</h2></div>
        <div className="conn">
          <span className="avatar"><Icon name="cal" /></span>
          <div style={{ minWidth: 0 }}>
            <b>Google Calendar</b>
            <p className="small muted">
              {calConn?.status === "ok" ? `Connected${calConn.email ? ` as ${calConn.email}` : ""}${calConn.lastSyncedAt ? `, last synced ${new Date(calConn.lastSyncedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}. Read-only: Kingdom reads event titles, times and attendees from the calendars you include, never descriptions, and never changes anything.`
                : calConn?.status === "expired" ? "Google stopped Kingdom's access. Reconnect to keep your week up to date."
                : "Read-only. Shows your real week next to your workouts, finds open evenings, and suggests linking meetings to people in your network (you confirm each one). Use your personal Google account."}
            </p>
            {calConn?.status === "ok" && !calConn.canList && (
              <p className="small caution">Kingdom can only read your main calendar right now. <a href="/api/connections/calendar/start">Reconnect once</a> and allow &quot;see the list of your calendars&quot; to include holidays, birthdays and shared calendars.</p>
            )}
            {calConn?.status === "ok" && calConn.calendars.length > 0 && (
              <div className="cal-pick" role="group" aria-label="Calendars to include">
                <span className="lab">Calendars to include</span>
                {calConn.calendars.map((c) => (
                  <label key={c.id} className="toggle small">
                    <input type="checkbox" checked={c.selected} onChange={(e) => toggleCal(c.id, e.target.checked)} />
                    <i className="dot" style={{ background: c.color }} />{c.name}{c.primary ? <span className="faint"> (main)</span> : null}
                  </label>
                ))}
              </div>
            )}
            {calConn !== undefined && (
              <div className="btns" style={{ marginTop: 6 }}>
                {calConn?.status !== "ok" && <a className="btn primary" href="/api/connections/calendar/start">{calConn ? "Reconnect" : "Connect Google Calendar"}</a>}
                {calConn && <button className="btn ghost" onClick={disconnectCal}>Disconnect</button>}
              </div>
            )}
          </div>
          <span className={`pill ${calConn?.status === "ok" ? "good" : calConn ? "warn" : "info"}`}>{calConn?.status === "ok" ? "CONNECTED" : calConn ? "EXPIRED" : "OFF"}</span>
        </div>
        <div className="conn">
          <span className="avatar"><Icon name="chat" /></span>
          <div style={{ minWidth: 0 }}>
            <b>Gmail</b>
            <p className="small muted">
              {gmail?.status === "ok" ? `Connected as ${gmail.email}${gmail.lastSyncedAt ? `, last checked ${fmtSynced(gmail.lastSyncedAt)}` : ""}. `
                : gmail?.status === "expired" ? "Google stopped Kingdom's access. Reconnect to keep last-contact dates current. " : ""}
              For last-contact dates, Kingdom reads only who each email was from and to, and when{gmail?.digest ? " (the only messages it opens are under your daily digest label)" : ": never message text, subjects or attachments"}. It never sends anything. It updates &quot;last contact&quot; for people in your network who have an email address saved. Personal Gmail only.
            </p>
            {gmail !== undefined && (
              <div className="btns" style={{ marginTop: 6 }}>
                {gmail?.status !== "ok" && <a className="btn primary" href={`/api/connections/gmail/start${gmail?.digest ? "?digest=1" : ""}`}>{gmail ? "Reconnect" : "Connect Gmail"}</a>}
                {gmail?.status === "ok" && <button className="btn" disabled={gmailBusy} onClick={syncGmail}>{gmailBusy ? "Checking…" : "Check now"}</button>}
                {gmail && <button className="btn ghost" onClick={disconnectGmail}>Disconnect</button>}
              </div>
            )}
          </div>
          <span className={`pill ${gmail?.status === "ok" ? "good" : gmail ? "warn" : "info"}`}>{gmail?.status === "ok" ? "CONNECTED" : gmail ? "EXPIRED" : "OFF"}</span>
        </div>
        {gmail?.status === "ok" && (
          <div className="conn">
            <span className="avatar"><Icon name="people" /></span>
            <div style={{ minWidth: 0 }} className="stack-s">
              <b>Daily digest</b>
              <p className="small muted">Email yourself a short end-of-day note about who you talked with. Kingdom opens only emails under the Gmail label below, has the AI pull out people and topics (customer and deal details are left out), and shows them in Network as suggestions you approve. Nothing changes until you tap Add, and the emails themselves aren&apos;t stored.</p>
              <label className="field"><span className="lab">Gmail label</span>
                <input className="in" id="digest-label" defaultValue={gmail.digestLabel} maxLength={100}
                  onBlur={async (e) => { const v = e.target.value.trim(); if (!v || v === gmail.digestLabel) return; try { await api("/api/connections", "PATCH", { digestLabel: v }); setGmail({ ...gmail, digestLabel: v }); toast(`Digest label set to "${v}".`); } catch (err) { toast(err instanceof Error ? err.message : "Not saved."); } }} />
              </label>
              <p className="small muted">In Gmail, make a filter for the digest&apos;s sender that applies this label.</p>
              {!gmail.digest && <div><a className="btn primary" href="/api/connections/gmail/start?digest=1">Turn on daily digest</a></div>}
              {!gmail.digest && <p className="small faint">Google will ask to let Kingdom read your email. Kingdom uses that only for messages under this label.</p>}
            </div>
            <span className={`pill ${gmail.digest ? "good" : "info"}`}>{gmail.digest ? "ON" : "OFF"}</span>
          </div>
        )}
        <div className="conn">
          <span className="avatar"><Icon name="people" /></span>
          <div style={{ minWidth: 0 }} className="stack-s">
            <b>LinkedIn</b>
            <p className="small muted">LinkedIn doesn&apos;t let personal apps read your connections, so there&apos;s no live link. Instead, import the Connections.csv from <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noreferrer">LinkedIn&apos;s data export</a>. People already in your network get blank fields filled in (company, title, profile link, email); nothing you wrote is overwritten.</p>
            {!li && (
              <label className="btn" style={{ justifySelf: "start" }}>
                {liBusy ? "Reading…" : "Choose Connections.csv"}
                <input type="file" accept=".csv,text/csv" hidden disabled={liBusy} onChange={(e) => { pickLinkedIn(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            )}
            {li && (
              <div className="stack-s">
                <p className="small">{li.preview.total} connections in the file. {li.preview.update} people in your network will get details filled in, {li.preview.unchanged} already match, and {li.preview.add} aren&apos;t in your network yet.</p>
                {li.preview.sample.length > 0 && <p className="small muted">New, for example: {li.preview.sample.join("; ")}</p>}
                <div className="btns">
                  <button className="btn primary" disabled={liBusy} onClick={() => importLinkedIn(false)}>Update existing only</button>
                  {li.preview.add > 0 && <button className="btn" disabled={liBusy} onClick={() => importLinkedIn(true)}>Also add {li.preview.add} new people</button>}
                  <button className="btn ghost" disabled={liBusy} onClick={() => setLi(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
          <span className="pill info">IMPORT</span>
        </div>
        <p className="small muted">Kingdom is personal. It will never connect to Cisco accounts, work email, customer data or internal systems.</p>
      </section>

      <section className="card stack-s">
        <h2>News</h2>
        <p className="small muted">A five-minute brief each morning: 5 stories, 3 quick headlines and a conversation starter, found with a web search. One topic per line, most important first.</p>
        <textarea className="in" id="news-topics" rows={6} defaultValue={(doc.newsTopics ?? []).join("\n")} placeholder={"Enterprise tech sales\nAI in business\nRaleigh–Durham\nStrength training research"}
          onBlur={(e) => { const v = e.target.value.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 12); mutate((d) => { d.newsTopics = v; }); }} />
        <label className="field"><span className="lab">Where you live (for local news)</span>
          <input className="in" id="news-location" defaultValue={doc.newsLocation ?? ""} placeholder="Raleigh, NC" maxLength={100} onBlur={(e) => mutate((d) => { d.newsLocation = e.target.value.trim(); })} />
        </label>
        <label className="field"><span className="lab">What you&apos;re working toward (shapes &ldquo;why it matters&rdquo;)</span>
          <textarea className="in" id="news-about" rows={3} defaultValue={doc.newsAbout ?? ""} maxLength={600} placeholder="Growing toward an account executive role in enterprise tech. Want to run a company someday. Long-term investor, not a trader."
            onBlur={(e) => mutate((d) => { d.newsAbout = e.target.value.trim(); })} />
        </label>
      </section>

      <AiSpend />


      <section className="card">
        <h2>Network</h2>
        <div className="field"><span className="lab">Relationship categories</span>
          <div className="chips">{doc.networkCategories.map((c) => <span key={c} className="chip">{c} <button className="iconbtn" style={{ padding: 0, display: "inline" }} aria-label={`Remove ${c}`} onClick={() => mutate((d) => { d.networkCategories = d.networkCategories.filter((x) => x !== c); })}>×</button></span>)}</div>
          <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); const c = newCat.trim(); if (!c || doc.networkCategories.includes(c)) return; mutate((d) => { d.networkCategories.push(c); }); setNewCat(""); }}>
            <input className="in" id="cat-new" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Add a category" /><button className="btn" type="submit">Add</button>
          </form>
        </div>
        <div className="field"><span className="lab">Relationship goals</span>
          {doc.networkGoals.map((g) => (
            <div className="row" key={g.id}>
              <span className="grow"><b>{g.title}</b><br /><span className="small muted">{METRIC_LABEL[g.metric]} · {g.target} per {g.period}</span></span>
              <button className="iconbtn" aria-label={`Remove ${g.title}`} onClick={() => mutate((d) => { d.networkGoals = d.networkGoals.filter((x) => x.id !== g.id); })}><Icon name="x" /></button>
            </div>
          ))}
          <form className="stack-s" onSubmit={(e) => { e.preventDefault(); if (!newGoal.title.trim()) return; mutate((d) => { d.networkGoals.push({ id: uid(), ...newGoal, title: newGoal.title.trim() }); }); setNewGoal({ ...newGoal, title: "" }); }}>
            <input className="in" id="ng-title" value={newGoal.title} onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })} placeholder="e.g. Schedule a mentor conversation" />
            <div style={{ display: "grid", gridTemplateColumns: "2fr 70px 1fr auto", gap: 8 }} className="ng-row">
              <select className="in" aria-label="Counts" value={newGoal.metric} onChange={(e) => setNewGoal({ ...newGoal, metric: e.target.value as NetworkMetric })}>{Object.entries(METRIC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <input className="in num" type="number" min={1} max={50} aria-label="Target" value={newGoal.target} onChange={(e) => setNewGoal({ ...newGoal, target: +e.target.value || 1 })} />
              <select className="in" aria-label="Per" value={newGoal.period} onChange={(e) => setNewGoal({ ...newGoal, period: e.target.value as "week" | "month" })}><option value="week">per week</option><option value="month">per month</option></select>
              <button className="btn" type="submit">Add</button>
            </div>
          </form>
        </div>
      </section>

      <ImportCard hasExisting onDone={(d, v) => { replaceDoc(d, v); toast("V1 data imported."); }} />

      <section className="card">
        <h2>Your data</h2>
        <p className="small muted">Everything is stored in your private database. Relationship notes are treated as sensitive and never leave Kingdom.</p>
        <div className="btns">
          <a className="btn" href="/api/export">Download everything (JSON)</a>
          <button className="btn" onClick={async () => { await api("/api/auth/logout", "POST"); location.href = "/login"; }}>Sign out</button>
        </div>
        {delStep === 0 && <div><button className="btn danger sm" onClick={() => setDelStep(1)}>Delete my account…</button></div>}
        {delStep === 1 && (
          <div className="stack-s">
            <p style={{ color: "var(--danger)" }}>This permanently erases your dashboard, network, conversations and coach history. Download a copy first if you might want it. Type DELETE to confirm.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="in" id="del-confirm" value={delText} onChange={(e) => setDelText(e.target.value)} placeholder="DELETE" />
              <button className="btn danger" disabled={delText !== "DELETE"} onClick={async () => { await api("/api/account", "DELETE", { confirm: "DELETE" }); location.href = "/login"; }}>Delete forever</button>
              <button className="btn ghost" onClick={() => { setDelStep(0); setDelText(""); }}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

type Spend = { today: number; month: number; total: number; calls: number; searches: number; byFeature: Record<string, number> };
const FEATURE: Record<string, string> = { news: "Morning brief", ask: "Ask", digest: "Daily digest", insights: "Insights" };
const money = (n: number) => (n > 0 && n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);

// What the AI features have cost, estimated from token counts at list price.
function AiSpend() {
  const [s, setS] = useState<Spend | null>(null);
  useEffect(() => { api<Spend>(`/api/usage?tz=${encodeURIComponent(tz())}`).then(setS).catch(() => {}); }, []);
  if (!s) return null;
  const parts = Object.entries(s.byFeature).sort((a, b) => b[1] - a[1]);
  return (
    <section className="card stack-s">
      <h2>AI spending</h2>
      <div className="spend">
        <div><span className="lab">Today</span><b className="num">{money(s.today)}</b></div>
        <div><span className="lab">This month</span><b className="num">{money(s.month)}</b></div>
        <div><span className="lab">Since you started</span><b className="num">{money(s.total)}</b></div>
      </div>
      {parts.length > 0 && <p className="small muted">This month: {parts.map(([k, v]) => `${FEATURE[k] ?? k} ${money(v)}`).join(" · ")}. {s.calls} calls, {s.searches} web searches.</p>}
      <p className="small faint">An estimate from list prices. Your Anthropic console shows the exact bill, and you can set a monthly spend limit there.</p>
    </section>
  );
}
