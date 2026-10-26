"use client";
import { useEffect, useState } from "react";
import type { Brief } from "@/lib/news";
import { api, tz } from "../api";
import { useApp } from "../App";

type Stored = Brief & { date: string; topics: string[]; at: string };

// The two top stories for him today: the lead headline from each of his top topics, with its picture.
// Made once a day from free news feeds.
export default function News() {
  const { doc, go } = useApp();
  const [state, setState] = useState<{ news: Stored | null; stale: Stored | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasTopics = (doc.newsTopics ?? []).some((t) => t.trim());

  const make = async () => {
    setBusy(true); setError(null);
    try { const r = await api<{ news: Stored }>("/api/news", "POST", { tz: tz() }); setState({ news: r.news, stale: null }); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't fetch news."); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    api<{ news: Stored | null; stale: Stored | null }>(`/api/news?tz=${encodeURIComponent(tz())}`)
      .then((r) => { setState(r); if (!r.news && hasTopics) make(); })
      .catch(() => setState({ news: null, stale: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) return null;
  if (!hasTopics) return <p className="small muted">Choose your news topics in <button className="linkish" style={{ color: "var(--gold)" }} onClick={() => go("setup")}>Settings</button>.</p>;
  const shown = state.news ?? state.stale;
  const top = (shown?.stories ?? []).slice(0, 2);
  return (
    <div className="headlines">
      {busy && !top.length && <p className="small muted">Loading today&apos;s news…</p>}
      {error && !top.length && <p className="small caution">{error} <button className="linkish" onClick={make}>Try again</button></p>}
      {top.map((s) => (
        <a key={s.url} className={`headline${s.image ? "" : " noimg"}`} href={s.url} target="_blank" rel="noopener noreferrer">
          {s.image && <img src={s.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
          <span className="headline-title">{s.title}</span>
          <span className="small faint">{s.source}</span>
        </a>
      ))}
    </div>
  );
}
