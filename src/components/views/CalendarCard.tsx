"use client";
import { useState } from "react";
import { DOW, fmtShort, parseKey } from "@/lib/life/dates";
import { fmtTime, type CalEvent } from "@/lib/life/calendar";
import { api } from "../api";
import { useApp } from "../App";
import { useCalendar } from "../calendar";

const timeLabel = (e: CalEvent) => (e.allDay ? "All day" : `${fmtTime(e.start!)}–${fmtTime(e.end!)}`);

// The real week from Google Calendar. Workouts live in the Training tab, not here;
// nothing here writes to Google.
export function CalendarWeek({ days, title = "Your week" }: { days: string[]; title?: string }) {
  const { today, go, reloadNet, toast } = useApp();
  const { cal, reload } = useCalendar(days[0], days.length);
  const [busy, setBusy] = useState<string | null>(null);

  const header = (
    <div className="card-head"><h2>{title}</h2>
      {cal.state === "ok" && <span className="pill good">GOOGLE CALENDAR</span>}
      {cal.state === "off" && <span className="pill info">CALENDAR NOT CONNECTED</span>}
      {cal.state === "expired" && <span className="pill warn">RECONNECT</span>}
    </div>
  );
  const events = cal.state === "ok" ? cal.events : [];

  const act = async (id: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(id);
    try { await fn(); toast(msg); await Promise.all([reload(), reloadNet()]); }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work."); }
    finally { setBusy(null); }
  };

  return (
    <section className="card">
      {header}
      {cal.state === "loading" && <p className="small muted">Loading Google Calendar…</p>}
      {cal.state === "off" && <p className="small muted"><button className="linkish" style={{ color: "var(--gold)" }} onClick={() => go("setup")}>Connect Google Calendar</button> (read-only) to see your week here.</p>}
      {cal.state === "expired" && <p className="small muted">Google stopped Kingdom&apos;s calendar access. <a href="/api/connections/calendar/start">Reconnect Google Calendar</a>.</p>}
      {cal.state === "error" && <p className="small muted">{cal.message} <button className="linkish" onClick={reload}>Try again</button></p>}
      {cal.state === "ok" && cal.needsReconnectForList && (
        <p className="small caution">Only your main calendar is being read. <a href="/api/connections/calendar/start">Reconnect once</a> to let Kingdom see your other calendars (holidays, birthdays, shared ones) and choose which to include.</p>
      )}
      {cal.state === "ok" && cal.problems.map((p) => <p key={p.calendar} className="small caution">{p.calendar}: {p.message}</p>)}

      <div className="calweek">
        {days.map((d) => {
          const allDay = events.filter((e) => e.date === d && e.allDay);
          const timed = events.filter((e) => e.date === d && !e.allDay);
          return (
            <div key={d} className={`calday${d === today ? " today" : ""}${d < today ? " past" : ""}`}>
              <div className="calday-head">
                <b>{DOW[(parseKey(d).getDay() + 6) % 7]}</b> <span className="faint small">{fmtShort(d)}</span>
                
              </div>
              {allDay.map((e) => (
                <div key={`${e.calendarId}-${e.id}`} className="allday" style={{ borderColor: e.color }} title={e.calendar}>
                  <i className="dot" style={{ background: e.color }} />{e.title}{e.multiDay ? <span className="faint small"> · multi-day</span> : null}
                </div>
              ))}
              {timed.map((e) => (
                <div key={`${e.calendarId}-${e.id}-${e.start}`} className={`calev${e.free ? " free" : ""}`} title={e.calendar}>
                  <span className="num faint small"><i className="dot" style={{ background: e.color }} /> {timeLabel(e)}</span> <span>{e.title}</span>
                </div>
              ))}
              {!allDay.length && !timed.length && <div className="small faint">Nothing scheduled</div>}
            </div>
          );
        })}
      </div>

      {cal.state === "ok" && cal.suggestions.length > 0 && (
        <div className="stack-s" style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 15 }}>Meetings with people in your network?</h3>
          <p className="small muted">Nothing is linked until you confirm. Linking logs the meeting on their profile.</p>
          {cal.suggestions.map((sg) => (
            <div key={sg.eventId} className="row" style={{ flexWrap: "wrap" }}>
              <div className="grow" style={{ minWidth: 200 }}>
                <b>{sg.title}</b> <span className="small muted">· {fmtShort(sg.date)}</span>
                <div className="small muted">With {sg.personName}? ({sg.why})</div>
              </div>
              <button className="btn primary" disabled={busy === sg.eventId}
                onClick={() => act(sg.eventId, () => api("/api/calendar/link", "POST", { eventId: sg.eventId, personId: sg.personId, date: sg.date, title: sg.title }), `Logged on ${sg.personName}'s profile.`)}>Yes, link</button>
              <button className="btn ghost" disabled={busy === sg.eventId}
                onClick={() => act(sg.eventId, () => api("/api/calendar/dismiss", "POST", { eventId: sg.eventId }), "Got it. Won't suggest that one again.")}>No</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
