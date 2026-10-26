"use client";
import { useMemo, useState } from "react";
import { addDays, daysBetween, fmtShort, monthOf } from "@/lib/life/dates";
import {
  INTERACTION_KINDS, INTERACTION_XP, COMMITMENT_XP, lastContact, metricCount, METRIC_LABEL, needsTakeaways,
  openCommitments, reconnectList, recentInteractions, upcomingMeetings, type Interaction, type Person,
} from "@/lib/life/network";
import { api } from "../api";
import { useApp } from "../App";
import DigestSuggestions from "./DigestSuggestions";
import { Bar, Check, Icon, initials, popXP } from "../ui";

const when = (k: string, today: string) => {
  const d = daysBetween(today, k);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  return fmtShort(k);
};

function PersonRow({ p, sub, right }: { p: Person; sub?: string; right?: React.ReactNode }) {
  const { go } = useApp();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button className="person-row" onClick={() => go("network", { person: p.id })}>
        <span className="avatar">{initials(p.name)}</span>
        <span className="grow"><b>{p.name}</b><br /><span className="small muted">{sub ?? [p.title, p.organization].filter(Boolean).join(" · ")}</span></span>
      </button>
      {right}
    </div>
  );
}

function AddPerson({ onClose }: { onClose: (id?: string) => void }) {
  const { doc, today, reloadNet, toast } = useApp();
  const [f, setF] = useState({ name: "", metWhere: "", metOn: today, organization: "", title: "", linkedinUrl: "", email: "", categories: [] as string[], summary: "", nextFollowUp: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | string[]) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    setBusy(true);
    try {
      const { person } = await api<{ person: Person }>("/api/people", "POST", {
        name: f.name, metWhere: f.metWhere, metOn: f.metOn || null, organization: f.organization, title: f.title,
        linkedinUrl: f.linkedinUrl, email: f.email, categories: f.categories, nextFollowUp: f.nextFollowUp || null,
      });
      if (f.summary.trim()) await api(`/api/people/${person.id}/interactions`, "POST", { occurredOn: f.metOn || today, kind: "conversation", summary: f.summary });
      await reloadNet();
      onClose(person.id);
    } catch (err) { toast(err instanceof Error ? err.message : "Couldn't save."); }
    setBusy(false);
  };
  return (
    <form className="card" onSubmit={save}>
      <div className="card-head"><h2>Add someone you just met</h2><button type="button" className="btn ghost sm" onClick={() => onClose()}>Cancel</button></div>
      <div className="fields">
        <div className="field"><label htmlFor="np-name">Name</label><input className="in" id="np-name" required value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus /></div>
        <div className="field"><label htmlFor="np-where">Where you met</label><input className="in" id="np-where" value={f.metWhere} onChange={(e) => set("metWhere", e.target.value)} placeholder="e.g. Friend's dinner, Raleigh tech meetup" /></div>
        <div className="field"><label htmlFor="np-when">When</label><input className="in" id="np-when" type="date" value={f.metOn} onChange={(e) => set("metOn", e.target.value)} /></div>
      </div>
      <div className="field"><span className="lab">Categories</span>
        <div className="chips">{doc.networkCategories.map((c) => <button type="button" key={c} className="chip" aria-pressed={f.categories.includes(c)}
          onClick={() => set("categories", f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c])}>{c}</button>)}</div></div>
      <div className="field"><label htmlFor="np-summary">What you talked about (optional)</label><textarea className="in" id="np-summary" rows={3} value={f.summary} onChange={(e) => set("summary", e.target.value)} placeholder="Family, interests, what they're working on, anything you want to remember" /></div>
      <details><summary className="small muted" style={{ cursor: "pointer" }}>More details</summary>
        <div className="fields" style={{ marginTop: 12 }}>
          <div className="field"><label htmlFor="np-org">Organization</label><input className="in" id="np-org" value={f.organization} onChange={(e) => set("organization", e.target.value)} /></div>
          <div className="field"><label htmlFor="np-title">Job title</label><input className="in" id="np-title" value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="field"><label htmlFor="np-li">LinkedIn profile URL</label><input className="in" id="np-li" value={f.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} placeholder="https://www.linkedin.com/in/…" /></div>
          <div className="field"><label htmlFor="np-email">Email</label><input className="in" id="np-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div className="field"><label htmlFor="np-fu">Follow up on</label><input className="in" id="np-fu" type="date" value={f.nextFollowUp} onChange={(e) => set("nextFollowUp", e.target.value)} /></div>
        </div>
      </details>
      <div><button className="btn primary" type="submit" disabled={busy || !f.name.trim()}>Save</button></div>
    </form>
  );
}

const PROFILE_FIELDS: [keyof Person, string, string?][] = [
  ["organization", "Organization"], ["title", "Job title"], ["location", "Location"], ["email", "Email", "email"],
  ["linkedinUrl", "LinkedIn profile URL"], ["metWhere", "Where we met"], ["metOn", "When we met", "date"],
];

function PersonView({ id }: { id: string }) {
  const { net, today, doc, reloadNet, toast, go } = useApp();
  const p = net.people.find((x) => x.id === id);
  const [draft, setDraft] = useState<Partial<Person>>({});
  const [log, setLog] = useState({ occurredOn: today, kind: "coffee", summary: "" });
  const [newC, setNewC] = useState({ text: "", dueOn: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  if (!p) return <div className="empty">That person isn&apos;t in your network anymore. <button className="btn ghost sm" onClick={() => go("network")}>Back</button></div>;

  const v = { ...p, ...draft };
  const dirty = Object.keys(draft).length > 0;
  const patch = async (body: Partial<Person>) => {
    try { await api(`/api/people/${id}`, "PATCH", body); await reloadNet(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save."); }
  };
  const timeline = net.interactions.filter((i) => i.personId === id).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  const commits = net.commitments.filter((c) => c.personId === id).sort((a, b) => Number(!!a.doneOn) - Number(!!b.doneOn));
  const last = p ? lastContact(p, net.interactions, today) : null;

  return (
    <>
      <div><button className="btn ghost sm" onClick={() => go("network")}>← People</button></div>
      <section className="card">
        <div className="skill-top" style={{ gap: 14 }}>
          <span className="avatar" style={{ width: 52, height: 52, fontSize: 16 }}>{initials(p.name)}</span>
          <div style={{ minWidth: 0 }} className="grow">
            <h1 style={{ fontSize: 26 }}>{p.name}</h1>
            <p className="muted small">{[p.title, p.organization].filter(Boolean).join(" · ") || "No title yet"}{last ? ` · ${last.label.toLowerCase()} ${when(last.on, today).toLowerCase()}` : ""}</p>
          </div>
          {p.linkedinUrl && <a className="btn ghost sm" href={p.linkedinUrl} target="_blank" rel="noopener noreferrer"><Icon name="link" />LinkedIn</a>}
        </div>
        <div className="field"><span className="lab">Categories</span>
          <div className="chips">{doc.networkCategories.map((c) => <button key={c} className="chip" aria-pressed={p.categories.includes(c)}
            onClick={() => patch({ categories: p.categories.includes(c) ? p.categories.filter((x) => x !== c) : [...p.categories, c] })}>{c}</button>)}</div></div>
        <div className="fields">
          <div className="field"><label htmlFor="p-fu">Next follow-up</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input className="in" id="p-fu" type="date" value={p.nextFollowUp ?? ""} onChange={(e) => patch({ nextFollowUp: e.target.value || null })} />
              <button className="btn sm" onClick={() => patch({ nextFollowUp: addDays(today, 7) })}>+1 wk</button>
              <button className="btn sm" onClick={() => patch({ nextFollowUp: addDays(today, 30) })}>+1 mo</button>
            </div></div>
          <label className="toggle" style={{ alignSelf: "end" }}><input type="checkbox" checked={p.aiAccess} onChange={(e) => patch({ aiAccess: e.target.checked })} />Let the coach see {p.name.split(" ")[0]}</label>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2>Conversations</h2><span className="xp">+{INTERACTION_XP} each</span></div>
          <form className="stack-s" onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api(`/api/people/${id}/interactions`, "POST", log);
              if (log.occurredOn <= today) popXP(e.currentTarget, INTERACTION_XP);
              setLog({ occurredOn: today, kind: "coffee", summary: "" });
              await reloadNet();
            } catch (err) { toast(err instanceof Error ? err.message : "Couldn't save."); }
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input className="in" type="date" aria-label="Date" value={log.occurredOn} onChange={(e) => setLog({ ...log, occurredOn: e.target.value })} />
              <select className="in" aria-label="Kind" value={log.kind} onChange={(e) => setLog({ ...log, kind: e.target.value })}>{INTERACTION_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            </div>
            <textarea className="in" id="log-summary" rows={3} value={log.summary} onChange={(e) => setLog({ ...log, summary: e.target.value })}
              placeholder={log.occurredOn > today ? "Planned. Add an agenda or questions (optional)" : "What did you talk about? What matters to them right now?"} />
            <div><button className="btn primary sm" type="submit">{log.occurredOn > today ? "Plan it" : "Log conversation"}</button></div>
          </form>
          <div className="timeline">
            {timeline.length ? timeline.map((i) => (
              <div className="tl-item" key={i.id}>
                <span className="tl-date small num muted">{when(i.occurredOn, today)}{i.occurredOn > today && <><br /><span className="pill info">PLANNED</span></>}</span>
                <div style={{ minWidth: 0 }}>
                  <span className="eyebrow">{i.kind}</span>
                  {editing === i.id ? (
                    <div className="stack-s" style={{ marginTop: 6 }}>
                      <textarea className="in" rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} aria-label="Takeaways" />
                      <div className="btns"><button className="btn primary sm" onClick={async () => { await api(`/api/interactions/${i.id}`, "PATCH", { summary: editText }); setEditing(null); reloadNet(); }}>Save</button>
                        <button className="btn ghost sm" onClick={() => setEditing(null)}>Cancel</button></div>
                    </div>
                  ) : i.summary ? <p style={{ whiteSpace: "pre-wrap" }}>{i.summary}</p>
                    : <p className="muted small">{i.occurredOn < today ? "No notes yet." : "Nothing written yet."} <button className="btn ghost sm" onClick={() => { setEditing(i.id); setEditText(""); }}>{i.occurredOn < today ? "Add takeaways" : "Add agenda"}</button></p>}
                </div>
                <span>
                  {i.summary && editing !== i.id && <button className="iconbtn" aria-label="Edit notes" onClick={() => { setEditing(i.id); setEditText(i.summary); }}><Icon name="sliders" /></button>}
                  <button className="iconbtn" aria-label="Delete conversation" onClick={async () => { await api(`/api/interactions/${i.id}`, "DELETE"); reloadNet(); }}><Icon name="x" /></button>
                </span>
              </div>
            )) : <div className="empty">No conversations logged yet.</div>}
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-head"><h2>Commitments</h2><span className="xp">+{COMMITMENT_XP} kept</span></div>
            {commits.map((c) => (
              <div className={`row${c.doneOn ? " done" : ""}`} key={c.id}>
                <Check on={!!c.doneOn} label={`Mark ${c.text} done`} onClick={async (e) => {
                  if (!c.doneOn) popXP(e.currentTarget, COMMITMENT_XP);
                  await api(`/api/commitments/${c.id}`, "PATCH", { doneOn: c.doneOn ? null : today }); reloadNet();
                }} />
                <span className="grow quest-name">{c.text}{c.dueOn && <span className="small muted"> · due {when(c.dueOn, today)}</span>}</span>
                <button className="iconbtn" aria-label="Delete commitment" onClick={async () => { await api(`/api/commitments/${c.id}`, "DELETE"); reloadNet(); }}><Icon name="x" /></button>
              </div>
            ))}
            <form className="commit-form" onSubmit={async (e) => {
              e.preventDefault();
              if (!newC.text.trim()) return;
              await api(`/api/people/${id}/commitments`, "POST", { text: newC.text, dueOn: newC.dueOn || null });
              setNewC({ text: "", dueOn: "" }); reloadNet();
            }}>
              <input className="in" id="c-new" value={newC.text} onChange={(e) => setNewC({ ...newC, text: e.target.value })} placeholder="I said I'd…" />
              <input className="in" type="date" aria-label="Due" value={newC.dueOn} onChange={(e) => setNewC({ ...newC, dueOn: e.target.value })} />
              <button className="btn" type="submit">Add</button>
            </form>
          </section>
          <section className="card">
            <div className="card-head"><h2>Profile</h2>{dirty && <button className="btn primary sm" onClick={async () => { await patch(draft); setDraft({}); }}>Save changes</button>}</div>
            <div className="field"><label htmlFor="p-name">Name</label><input className="in" id="p-name" value={String(v.name)} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="fields">
              {PROFILE_FIELDS.map(([k, label, type]) => (
                <div className="field" key={k}><label htmlFor={`p-${k}`}>{label}</label>
                  <input className="in" id={`p-${k}`} type={type ?? "text"} value={(v[k] as string | null) ?? ""} onChange={(e) => setDraft({ ...draft, [k]: type === "date" ? e.target.value || null : e.target.value })} /></div>
              ))}
            </div>
            <div className="field"><label htmlFor="p-interests">Shared interests</label><input className="in" id="p-interests" value={v.interests} onChange={(e) => setDraft({ ...draft, interests: e.target.value })} /></div>
            <div className="field"><label htmlFor="p-notes">Notes</label><textarea className="in" id="p-notes" rows={5} value={v.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Family, what they care about, how you can serve them" /></div>
            <div className="btns">
              {confirmDel
                ? <><button className="btn danger" onClick={async () => { await api(`/api/people/${id}`, "DELETE"); await reloadNet(); go("network"); }}>Yes, delete {p.name} and all notes</button><button className="btn ghost" onClick={() => setConfirmDel(false)}>Keep</button></>
                : <button className="btn ghost danger sm" onClick={() => setConfirmDel(true)}>Delete person</button>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export default function Network() {
  const { net, today, doc, person, go, reloadNet } = useApp();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const byId = useMemo(() => new Map(net.people.map((p) => [p.id, p])), [net.people]);

  if (person) return <PersonView id={person} />;
  if (adding) return <AddPerson onClose={(id) => { setAdding(false); if (id) go("network", { person: id }); }} />;

  const rec = reconnectList(net, today);
  const up = upcomingMeetings(net, today);
  const nt = needsTakeaways(net, today);
  const oc = openCommitments(net);
  const recent = recentInteractions(net, today, 6);
  const month = monthOf(today);
  const newThisMonth = net.people.filter((p) => (p.metOn ?? p.addedOn).startsWith(month));
  const ql = q.trim().toLowerCase();
  const directory = net.people.filter((p) => (!cat || p.categories.includes(cat)) &&
    (!ql || [p.name, p.organization, p.title, p.notes, p.interests, p.metWhere, p.location, ...net.interactions.filter((i) => i.personId === p.id).map((i) => i.summary)].some((s) => s.toLowerCase().includes(ql))));
  const name = (i: Interaction) => byId.get(i.personId);

  return (
    <>
      <div className="sec-head">
        <h2 className="sec-title">People</h2>
        <button className="btn primary sm" onClick={() => setAdding(true)}><Icon name="plus" />Add someone</button>
      </div>

      <DigestSuggestions />

      <div className="stat-row">
        <div className="stat"><span className="eyebrow">People</span><b>{net.people.length}</b></div>
        <div className="stat"><span className="eyebrow">New this month</span><b>{newThisMonth.length}</b></div>
        <div className="stat"><span className="eyebrow">Conversations this month</span><b>{metricCount("conversations", "month", net, today)}</b></div>
        <div className="stat"><span className="eyebrow">Open commitments</span><b>{oc.length}</b></div>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2>Reconnect this week</h2><span className="small muted">Follow-up dates and each relationship&apos;s usual rhythm</span></div>
          {rec.length ? <div>{rec.slice(0, 8).map((r) => <PersonRow key={r.person.id} p={r.person} sub={r.why}
            right={<button className="btn ghost sm" title="Remind me in a week" onClick={async () => { await api(`/api/people/${r.person.id}`, "PATCH", { nextFollowUp: addDays(today, 7) }); reloadNet(); }}>Later</button>} />)}</div>
            : <div className="empty">{net.people.length ? "No one is overdue. Nice." : "Add the people who matter to you and Kingdom will remind you to stay in touch."}</div>}
        </section>
        <section className="card">
          <div className="card-head"><h2>Coming up</h2></div>
          {up.length ? up.slice(0, 6).map((i) => { const p = name(i); return p && <PersonRow key={i.id} p={p} sub={`${when(i.occurredOn, today)} · ${i.kind}`}
 />; })
            : <div className="empty">Plan a coffee or call from someone&apos;s profile by logging it with a future date.</div>}
          {nt.length > 0 && <>
            <h3 style={{ marginTop: 8 }}>Write down takeaways</h3>
            {nt.map((i) => { const p = name(i); return p && <PersonRow key={i.id} p={p} sub={`${i.kind} ${when(i.occurredOn, today).toLowerCase()}, no notes yet`} />; })}
          </>}
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2>Relationship goals</h2><button className="btn ghost sm" onClick={() => go("setup")}>Edit</button></div>
          {(doc.networkGoals ?? []).map((g) => {
            const n = metricCount(g.metric, g.period, net, today);
            const a = doc.areas.find((x) => x.id === g.areaId);
            return (
              <div className="mission" key={g.id}>
                <div style={{ minWidth: 0 }}><div className="quest-name">{g.title} <span className="num muted small">{n}/{g.target}</span> {n >= g.target && <span className="pill good">MET</span>}</div>
                  <span className="tag"><i className="dot" style={{ background: a?.color }} />{METRIC_LABEL[g.metric]} · this {g.period}</span></div>
                <span />
                <Bar frac={n / g.target} color={a?.color} />
              </div>
            );
          })}
          <p className="small muted">Counted automatically from what you log. Every conversation earns the same XP, whoever it&apos;s with.</p>
        </section>
        <section className="card">
          <div className="card-head"><h2>Open commitments</h2></div>
          {oc.length ? oc.slice(0, 8).map((c) => (
            <div className="row" key={c.id}>
              <Check on={false} label={`Mark ${c.text} done`} onClick={async (e) => { popXP(e.currentTarget, COMMITMENT_XP); await api(`/api/commitments/${c.id}`, "PATCH", { doneOn: today }); reloadNet(); }} />
              <span className="grow"><span className="quest-name">{c.text}</span><br /><span className="small muted">for {byId.get(c.personId)?.name}{c.dueOn ? ` · due ${when(c.dueOn, today)}` : ""}</span></span>
              {c.dueOn && c.dueOn < today && <span className="pill warn">LATE</span>}
            </div>
          )) : <div className="empty">Nothing outstanding.</div>}
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h2>Recent conversations</h2></div>
        {recent.length ? recent.map((i) => { const p = name(i); return p && <PersonRow key={i.id} p={p} sub={`${when(i.occurredOn, today)} · ${i.kind}${i.summary ? ` · ${i.summary.slice(0, 80)}${i.summary.length > 80 ? "…" : ""}` : ""}`} />; })
          : <div className="empty">Conversations you log show up here.</div>}
      </section>

      <section className="card">
        <div className="card-head"><h2>Directory</h2><span className="small muted num">{directory.length} of {net.people.length}</span></div>
        <input className="in" id="dir-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names, companies, notes, conversations" />
        <div className="chips">
          <button className="chip" aria-pressed={!cat} onClick={() => setCat(null)}>All</button>
          {doc.networkCategories.map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(cat === c ? null : c)}>{c}</button>)}
        </div>
        {directory.length ? <div>{directory.map((p) => {
          const last = lastContact(p, net.interactions, today);
          return <PersonRow key={p.id} p={p} sub={[[p.title, p.organization].filter(Boolean).join(" · "), p.categories.join(", "), last ? `${last.label.toLowerCase()} ${when(last.on, today).toLowerCase()}` : "no contact logged yet"].filter(Boolean).join(" — ")} />;
        })}</div> : <div className="empty">{net.people.length ? "No one matches that search." : "No one here yet. Tap Add someone right after you meet a person."}</div>}
      </section>
    </>
  );
}
