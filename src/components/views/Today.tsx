"use client";
import { useState } from "react";
import { BOOKS, chaptersIn, markRead, NEXT_BOOKS, readingHabit, readingOf, startBook, todaysChapter } from "@/lib/life/bible";
import { fmtTime } from "@/lib/life/calendar";
import { addDays, fmtLong } from "@/lib/life/dates";
import { doneOn, scheduledOn, setDone } from "@/lib/life/habits";
import { openCommitments, reconnectList, upcomingMeetings } from "@/lib/life/network";
import { useApp } from "../App";
import { useCalendar } from "../calendar";
import { Check } from "../ui";
import CalendarView from "./CalendarView";
import News from "./News";
import Passage from "./Passage";
import Now from "./Now";

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

// The dashboard's daily flow, after the welcome screen: what this block is for, the day at a glance,
// who to follow up with, then the week ahead.
export default function Today({ onOpenWorkout }: { onOpenWorkout: (id: string) => void }) {
  const { today, openWelcome } = useApp();
  const { cal } = useCalendar(today, 1);
  return (
    <div className="today">
      <div className="hello row-wrap" style={{ alignItems: "center" }}>
        <h1 className="grow">Today</h1>
        <button className="btn ghost sm" onClick={openWelcome}>Verse &amp; news</button>
      </div>
      <Now cal={cal} onOpenWorkout={onOpenWorkout} />
      <DayPlan cal={cal} />
      <FollowUps />
      <div className="sec"><CalendarView from={addDays(today, 1)} /></div>
    </div>
  );
}

// Today's calendar, and the habits due today as one-tap checks.
function DayPlan({ cal }: { cal: ReturnType<typeof useCalendar>["cal"] }) {
  const { doc, today, mutate, go } = useApp();
  const events = cal.state === "ok" ? cal.events.filter((e) => e.date === today) : [];
  const allDay = events.filter((e) => e.allDay);
  const timed = events.filter((e) => !e.allDay).sort((a, b) => a.start! - b.start!);
  const due = doc.habits.filter((h) => scheduledOn(h, today));
  const doneCount = due.filter((h) => doneOn(doc, h.id, today)).length;
  const d = new Date(); const nowMin = d.getHours() * 60 + d.getMinutes();

  return (
    <section className="card stack-s">
      <div className="card-head"><h2>Today</h2>{due.length > 0 && <span className="small muted num">{doneCount}/{due.length} habits</span>}</div>
      {allDay.map((e) => <div key={`${e.calendarId}-${e.id}`} className="plan-row"><span className="plan-time">All day</span><span className="grow">{e.title}</span></div>)}
      {timed.map((e) => <div key={`${e.calendarId}-${e.id}-${e.start}`} className={`plan-row${e.end! <= nowMin ? " past" : e.start! <= nowMin ? " current" : ""}`}><span className="plan-time">{fmtTime(e.start!)}</span><span className="grow">{e.title}</span></div>)}
      {cal.state === "off" && <p className="small muted"><button className="linkish" onClick={() => go("setup")}>Connect Google Calendar</button> to see your day here.</p>}
      {cal.state === "expired" && <p className="small muted"><a href="/api/connections/calendar/start">Reconnect Google Calendar</a> to see your day here.</p>}
      {cal.state === "ok" && !events.length && <p className="small muted">Nothing on the calendar today.</p>}
      {due.length > 0 && (
        <div className="habit-checks">
          {due.map((h) => {
            const on = doneOn(doc, h.id, today);
            return (
              <div key={h.id} className={`habit-check${on ? " on" : ""}`}>
                <Check on={on} label={`Mark ${h.name} done`} onClick={() => mutate((d) => setDone(d, h.id, today, !on))} />
                <span className="grow">{h.name}{readingHabit(doc)?.id === h.id && <span className="small faint"> · {todaysChapter(doc, today).label}</span>}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// Who to get back to: overdue relationships, meetings coming up and promises made. Hidden when there's nothing.
function FollowUps() {
  const { net, today, go } = useApp();
  const byId = new Map(net.people.map((p) => [p.id, p]));
  const rows: { key: string; personId: string; text: string; sub: string }[] = [];
  for (const i of upcomingMeetings(net, today).filter((x) => x.occurredOn <= addDays(today, 2)).slice(0, 2)) {
    rows.push({ key: `m${i.id}`, personId: i.personId, text: byId.get(i.personId)?.name ?? "", sub: `${i.occurredOn === today ? "Today" : "Coming up"} · ${i.kind}` });
  }
  for (const c of openCommitments(net).filter((x) => !x.dueOn || x.dueOn <= addDays(today, 3)).slice(0, 2)) {
    rows.push({ key: `c${c.id}`, personId: c.personId, text: c.text, sub: `for ${byId.get(c.personId)?.name ?? ""}${c.dueOn && c.dueOn < today ? " · late" : ""}` });
  }
  for (const r of reconnectList(net, today).slice(0, 2)) rows.push({ key: `r${r.person.id}`, personId: r.person.id, text: `Reach out to ${r.person.name}`, sub: r.why });
  if (!rows.length) return null;
  return (
    <section className="card stack-s">
      <div className="card-head"><h2>Follow up</h2><button className="btn ghost sm" onClick={() => go("network")}>People</button></div>
      {rows.map((r) => (
        <button key={r.key} className="plan-row linkish" onClick={() => go("network", { person: r.personId })}>
          <span className="grow"><span className="quest-name">{r.text}</span><br /><span className="small muted">{r.sub}</span></span>
        </button>
      ))}
    </section>
  );
}

export function Welcome({ onOpen }: { onOpen: () => void }) {
  const { doc, today } = useApp();
  const first = doc.name?.split(" ")[0];
  return (
    <main className="wrap welcome">
      <div className="hello">
        <h1>{greeting()}{first ? `, ${first}` : ""}</h1>
        <p className="muted">{fmtLong(today)}</p>
      </div>
      <Scripture />
      <News />
      <button className="btn primary big welcome-go" onClick={onOpen}>Open Kingdom dashboard</button>
    </main>
  );
}

// Scripture: today's chapter of his plan, read in place and marked read in one tap. The verse he taps becomes
// his verse of the day. Finishing a book asks what to read next.
function Scripture() {
  const { doc, today, mutate, toast } = useApp();
  const [reading, setReading] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const plan = readingOf(doc, today);
  const t = todaysChapter(doc, today);
  const verse = doc.days[today]?.verse;
  const total = chaptersIn(plan.book);
  const doneCh = plan.finished ? total : plan.chapter - 1;
  const start = (book: string) => { mutate((d) => startBook(d, book, today)); setChoosing(false); toast(`Now reading ${book}.`); };
  if (t.finished || choosing) {
    return (
      <section className="card stack-s">
        <span className="eyebrow">Scripture</span>
        <h2>{t.finished ? `You finished ${plan.book}` : "Read a different book"}</h2>
        <p className="small muted">Pick what to read next. It starts at chapter 1.</p>
        <div className="chips">{NEXT_BOOKS.filter((b) => b !== plan.book).map((b) => <button key={b} className="chip" onClick={() => start(b)}>{b}</button>)}</div>
        <select className="in" value="" onChange={(e) => e.target.value && start(e.target.value)}>
          <option value="">Any book…</option>
          {BOOKS.map(([b]) => <option key={b} value={b}>{b}</option>)}
        </select>
        {choosing && <button className="btn ghost sm" onClick={() => setChoosing(false)}>Cancel</button>}
      </section>
    );
  }
  return (
    <section className="card votd">
      <div className="card-head"><span className="eyebrow">Scripture · {plan.book} {doneCh}/{total}</span>
        <button className="linkish small faint" onClick={() => setChoosing(true)}>Change</button></div>
      {verse && <><blockquote>{verse.text}</blockquote><span className="small muted">{verse.ref} · verse of the day</span></>}
      <div className="row-wrap" style={{ alignItems: "center" }}>
        <span className="grow">{t.read ? <>Read today: <b>{t.label}</b> ✓</> : <>Today: <b>{t.label}</b></>}</span>
        <button className="btn ghost sm" onClick={() => setReading(!reading)}>{reading ? "Close" : t.read ? "Open" : "Read"}</button>
        {!t.read
          ? <button className="btn primary sm" onClick={() => { mutate((d) => markRead(d, today, true)); setReading(false); toast(`${t.label} read.`); }}>Mark read</button>
          : <button className="btn ghost sm" onClick={() => mutate((d) => markRead(d, today, false))}>Undo</button>}
      </div>
      <div className="bar gold"><i style={{ width: `${Math.round((doneCh / total) * 100)}%` }} /></div>
      {!verse && reading && <p className="small faint">Tap the verse that stands out to make it your verse of the day.</p>}
      {reading && <Passage chapter={t.label} />}
    </section>
  );
}
