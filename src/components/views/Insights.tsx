"use client";
import { useEffect, useState } from "react";
import { api, tz } from "../api";

type Item = { area: "calendar" | "fitness" | "habits" | "network"; title: string; basis: string };
type Stored = { date: string; items: Item[]; at: string };
const AREA: Record<Item["area"], string> = { calendar: "Calendar", fitness: "Fitness", habits: "Habits", network: "Network" };

// A few patterns and heads-ups for today, made once a day from his data. Each shows what it's based on.
export default function Insights() {
  const [state, setState] = useState<{ configured: boolean; insights: Stored | null; stale: Stored | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const make = async () => {
    setBusy(true); setError(null);
    try { const r = await api<{ insights: Stored }>("/api/insights", "POST", { tz: tz() }); setState((s) => s && { ...s, insights: r.insights, stale: null }); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't make insights."); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    api<{ configured: boolean; insights: Stored | null; stale: Stored | null }>(`/api/insights?tz=${encodeURIComponent(tz())}`)
      .then((r) => { setState(r); if (r.configured && !r.insights) make(); })
      .catch(() => setState({ configured: false, insights: null, stale: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) return null;
  const shown = state.insights ?? state.stale;
  return (
    <section className="card stack-s">
      <div className="card-head"><h2>Insights</h2>
        {state.configured && <button className="btn ghost sm" disabled={busy} onClick={make}>{busy ? "Thinking…" : "Refresh"}</button>}
      </div>
      {!state.configured && <p className="small muted">Insights need an Anthropic API key. Once it&apos;s added, you&apos;ll get a few patterns and heads-ups here each day, each showing the numbers behind it.</p>}
      {state.configured && busy && !shown && <p className="small muted">Looking at your calendar, training, habits and people…</p>}
      {error && <p className="small caution">{error}</p>}
      {shown && (
        <>
          {!state.insights && <p className="small faint">From {shown.date}. Refreshing…</p>}
          <div className="stack-s">
            {shown.items.map((it, i) => (
              <div key={i} className="insight">
                <span className="eyebrow">{AREA[it.area]}</span>
                <div>{it.title}</div>
                <div className="small muted">Based on: {it.basis}</div>
              </div>
            ))}
            {!shown.items.length && <p className="small muted">Nothing stood out today.</p>}
          </div>
        </>
      )}
    </section>
  );
}
