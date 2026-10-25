"use client";
import { useState } from "react";
import { DOW, fmtShort } from "@/lib/life/dates";
import { fmtHours, fmtTime, summarizeDay, type CalEvent } from "@/lib/life/calendar";
import { api } from "../api";
import { useApp } from "../App";
import { useCalendar } from "../calendar";

const timeLabel = (e: CalEvent) => (e.allDay ? "All day" : `${fmtTime(e.start!)}–${fmtTime(e.end!)}`);

// The real week from Google Calendar: how full each day is, open evenings, and meetings to link to people.
export function CalendarWeek({ days }: { days: string[] }) {
  const { today, go, reloadNet, toast } = useApp();
  const { cal, reload } = useCalendar(days[0], days.length);
  const [busy, setBusy] = useState<string | null>(null);

  if (cal.state === "loading") return <section className="card"><h2>Your calendar</h2><p className="small muted">Loading Google Calendar…</p></section>;
  if (cal.state === "off") return (
    <section className="card">
      <div className="card-head"><h2>Your calendar</h2><span className="pill info">NOT CONNECTED</span></div>
      <p className="small muted">Connect Google Calendar (read-only) to see how your week is really shaped, which evenings are open, and which days are overloaded.</p>
      <div className="btns"><button className="btn" onClick={() => go("setup")}>Connect in Setup</button></div>
    </section>
  );
  if (cal.state === "expired") return (
    <section className="card">
      <div className="card-head"><h2>Your calendar</h2><span className="pill warn">RECONNECT</span></div>
      <p className="small muted">Google stopped Kingdom&apos;s calendar access. Reconnect it to see your week again.</p>
      <div className="btns"><a className="btn" href="/api/connections/calendar/start">Reconnect Google Calendar</a></div>
    </section>
  );
  if (cal.state === "error") return <section className="card"><h2>Your calendar</h2><p className="small muted">{cal.message}</p><div className="btns"><button className="btn" onClick={reload}>Try again</button></div></section>;

  const sums = days.map((d) => summarizeDay(cal.events, d));
  const openEvenings = sums.filter((s) => s.date >= today && s.eveningFree).map((s) => DOW[days.indexOf(s.date)]);
  const heavy = sums.filter((s) => s.overloaded).map((s) => DOW[days.indexOf(s.date)]);

  const act = async (id: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(id);
    try { await fn(); toast(msg); await Promise.all([reload(), reloadNet()]); }
    catch (e) { toast(e instanceof Error ? e.message : "That didn't work."); }
    finally { setBusy(null); }
  };

  return (
    <section className="card">
      <div className="card-head"><h2>Your calendar</h2><span className="pill good">GOOGLE CALENDAR</span></div>
      <p className="small muted">
        {openEvenings.length ? `Open evenings left: ${openEvenings.join(", ")}.` : "No open evenings left this week."}
        {heavy.length ? ` Overloaded: ${heavy.join(", ")}.` : ""}
      </p>
      <div className="calweek">
        {days.map((d, i) => {
          const s = sums[i];
          const evs = cal.events.filter((e) => e.date === d);
          return (
            <div key={d} className={`calday${d === today ? " today" : ""}${d < today ? " past" : ""}`}>
              <div className="calday-head">
                <b>{DOW[i]}</b> <span className="faint small">{fmtShort(d)}</span>
                <span className="small muted">{s.count ? `${fmtHours(s.busyMinutes)} booked` : "Clear"}</span>
                <span className="calflags">
                  {s.overloaded && <span className="pill warn">HEAVY</span>}
                  {s.eveningFree && <span className="pill good">EVENING FREE</span>}
                </span>
              </div>
              {evs.map((e) => (
                <div key={e.id + e.date} className={`calev${e.free ? " free" : ""}`}>
                  <span className="num faint small">{timeLabel(e)}</span> <span>{e.title}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {cal.suggestions.length > 0 && (
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

// Today's events, compact, for the home screen. Renders nothing when the calendar isn't connected.
export function CalendarToday() {
  const { today } = useApp();
  const { cal } = useCalendar(today, 1);
  if (cal.state !== "ok") return null;
  const s = summarizeDay(cal.events, today);
  const evs = cal.events.filter((e) => e.date === today);
  return (
    <section className="card">
      <div className="card-head"><h2>Today&apos;s calendar</h2><span className="small muted">{s.count ? `${fmtHours(s.busyMinutes)} booked` : "Clear"}{s.eveningFree ? " · evening free" : ""}</span></div>
      {evs.length ? evs.map((e) => <div key={e.id} className={`calev${e.free ? " free" : ""}`}><span className="num faint small">{timeLabel(e)}</span> <span>{e.title}</span></div>)
        : <p className="small muted">Nothing on the calendar today.</p>}
    </section>
  );
}
