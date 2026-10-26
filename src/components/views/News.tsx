"use client";
import { useEffect, useState } from "react";
import type { Brief } from "@/lib/news";
import { api, tz } from "../api";
import { useApp } from "../App";

type Stored = Brief & { date: string; topics: string[]; at: string };

// Today's brief on the topics he picked. Made once a day; every link came back from a real web search.
export default function News() {
  const { doc, go } = useApp();
  const [state, setState] = useState<{ configured: boolean; news: Stored | null; stale: Stored | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const hasTopics = (doc.newsTopics ?? []).some((t) => t.trim());

  const make = async () => {
    setBusy(true); setError(null);
    try { const r = await api<{ news: Stored }>("/api/news", "POST", { tz: tz() }); setState((s) => s && { ...s, news: r.news, stale: null }); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't fetch news."); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    api<{ configured: boolean; news: Stored | null; stale: Stored | null }>(`/api/news?tz=${encodeURIComponent(tz())}`)
      .then((r) => { setState(r); if (r.configured && !r.news && hasTopics) make(); })
      .catch(() => setState({ configured: false, news: null, stale: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) return null;
  const shown = state.news ?? state.stale;
  return (
    <section className="card stack-s">
      <div className="card-head"><h2>Morning brief</h2>
        {state.configured && hasTopics && <button className="btn ghost sm" disabled={busy} onClick={make}>{busy ? "Searching…" : "Refresh"}</button>}
      </div>
      {!state.configured && <p className="small muted">News needs an Anthropic API key. Once it&apos;s added, you&apos;ll get a five-minute brief each day on topics you choose.</p>}
      {state.configured && !hasTopics && <p className="small muted">Pick what you want news about in <button className="linkish" onClick={() => go("setup")}>Settings</button>, like your industry, your city, or teams you follow.</p>}
      {state.configured && hasTopics && busy && <p className="small muted">Gathering today&apos;s headlines…</p>}
      {error && <p className="small caution">{error}</p>}
      {shown && (
        <div className="stack-s">
          {!state.news && <p className="small faint">From {shown.date}.</p>}
          {shown.stories.map((s) => (
            <div key={s.url} className="story">
              <button className="story-head" aria-expanded={open === s.url} onClick={() => setOpen(open === s.url ? null : s.url)}>
                <span className="eyebrow">{s.topic} · {s.source}</span>
                <span className="story-title">{s.title}</span>
              </button>
              {open === s.url && (
                <div className="stack-s story-body">
                  {s.summary && <p className="small">{s.summary}</p>}
                  <p className="small muted"><b className="why">Why it matters:</b> {s.why}</p>
                  <a className="small" href={s.url} target="_blank" rel="noopener noreferrer">Read at {s.source} →</a>
                </div>
              )}
            </div>
          ))}
          {!shown.stories.length && <p className="small muted">Nothing new on your topics today.</p>}
          {(!!shown.quick?.length || shown.bigIdea || shown.starter) && !more && <button className="btn ghost sm" onClick={() => setMore(true)}>More headlines</button>}
          {more && !!shown.quick?.length && (
            <div className="brief-extra">
              <span className="eyebrow">Worth knowing</span>
              {shown.quick.map((h) => (
                <a key={h.url} className="quick" href={h.url} target="_blank" rel="noopener noreferrer">{h.title} <span className="faint">· {h.source}</span></a>
              ))}
            </div>
          )}
          {more && shown.bigIdea && <div className="brief-extra"><span className="eyebrow">Big idea</span><p className="small">{shown.bigIdea}</p></div>}
          {more && shown.starter && <div className="brief-extra"><span className="eyebrow">Conversation starter</span><p className="small">{shown.starter}</p></div>}
        </div>
      )}
    </section>
  );
}
