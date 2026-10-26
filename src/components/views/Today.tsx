"use client";
import { refLabel } from "@/lib/life/bible";
import { fmtTime } from "@/lib/life/calendar";
import { addDays, fmtLong } from "@/lib/life/dates";
import { doneOn, scheduledOn, setDone } from "@/lib/life/habits";
import { openCommitments, reconnectList, upcomingMeetings } from "@/lib/life/network";
import { useApp } from "../App";
import { useCalendar } from "../calendar";
import { Check } from "../ui";
import CalendarView from "./CalendarView";
import News from "./News";
import Now from "./Now";

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

// The daily flow, top to bottom: what this block is for, the day at a glance, the brief, who to follow up with,
// then the week ahead.
export default function Today({ onOpenWorkout }: { onOpenWorkout: (id: string) => void }) {
  const { doc, today } = useApp();
  const { cal } = useCalendar(today, 1);
  const first = doc.name?.split(" ")[0];
  return (
    <div className="today">
      <div className="hello">
        <h1>{greeting()}{first ? `, ${first}` : ""}</h1>
        <p className="muted">{fmtLong(today)}</p>
      </div>
      <Now cal={cal} onOpenWorkout={onOpenWorkout} />
      <DayPlan cal={cal} />
      <News />
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
                <span className="grow">{h.name}{h.plan && <span className="small faint"> · {on ? doc.days[today]?.read?.[h.id] : refLabel(h.plan)}</span>}</span>
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
