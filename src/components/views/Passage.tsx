"use client";
import { useEffect, useState } from "react";
import { api } from "../api";
import { useApp } from "../App";

type Text = { translation: string; verses: { n: number; text: string }[] };

// One chapter of his reading plan, the text only. Tapping a verse makes it today's verse of the day.
export default function Passage({ chapter }: { chapter: string }) {
  const { doc, today, mutate, toast } = useApp();
  const [p, setP] = useState<Text | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<Text>(`/api/reading?ref=${encodeURIComponent(chapter)}`).then(setP).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't load it."));
  }, [chapter]);
  const picked = doc.days[today]?.verse?.ref;
  const pick = (n: number, text: string) => {
    const ref = `${chapter}:${n}`;
    mutate((d) => {
      const day = (d.days[today] ??= { intention: "", priorities: [], done: {} });
      if (day.verse?.ref === ref) delete day.verse; else day.verse = { ref, text };
    });
    toast(picked === ref ? "Verse of the day cleared." : `${ref} is your verse of the day.`);
  };
  return (
    <div className="passage">
      <div className="passage-ref">{chapter}</div>
      {err && <p className="small muted">{err}</p>}
      {!p && !err && <p className="small muted">Loading…</p>}
      {p && <p>{p.verses.map((v) => (
        <span key={v.n} role="button" tabIndex={0} className={`verse${picked === `${chapter}:${v.n}` ? " picked" : ""}`}
          onClick={() => pick(v.n, v.text)} onKeyDown={(e) => { if (e.key === "Enter") pick(v.n, v.text); }}><sup>{v.n}</sup>{v.text} </span>
      ))}</p>}
      {p && <div className="small faint">{p.translation} · Tap a verse to make it your verse of the day.</div>}
    </div>
  );
}
