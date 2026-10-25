"use client";
import { useState } from "react";
import type { ImportPreview } from "@/lib/life/migrate";
import type { LifeDoc } from "@/lib/life/types";
import { api, tz } from "../api";

export default function Onboarding({ onReady, email }: { onReady: (d: LifeDoc, v: number) => void; email: string }) {
  return (
    <main className="wrap">
      <div className="view" style={{ paddingTop: 32 }}>
        <section className="hero single stack-s">
          <span className="brand">KINGDOM</span>
          <h1>Welcome. Bring your V1 dashboard with you, or start fresh.</h1>
          <p className="muted">Signed in as {email}.</p>
        </section>
        <ImportCard onDone={onReady} hasExisting={false} />
        <section className="card">
          <h2>Start fresh</h2>
          <p className="muted">Begins with your seven areas, five daily quests, this week&apos;s missions and your Kingdom Builder Protocol. You can import V1 later from Setup.</p>
          <div><button className="btn" onClick={async () => {
            const r = await api<{ doc: LifeDoc; version: number }>("/api/life", "POST", { start: "fresh", tz: tz() });
            onReady(r.doc, r.version);
          }}>Start fresh</button></div>
        </section>
      </div>
    </main>
  );
}

// Paste a V1 backup → see exactly what it holds → confirm. Nothing is saved before the confirm.
export function ImportCard({ onDone, hasExisting }: { onDone: (d: LifeDoc, v: number) => void; hasExisting: boolean }) {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<(ImportPreview & { hasExisting: boolean }) | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const check = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await api<{ preview: ImportPreview; hasExisting: boolean }>("/api/import", "POST", { raw, tz: tz() });
      setPreview({ ...r.preview, hasExisting: r.hasExisting });
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't read that backup."); setPreview(null); }
    setBusy(false);
  };
  const commit = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await api<{ doc: LifeDoc; version: number }>("/api/import", "POST", { raw, tz: tz(), commit: true, replace: preview?.hasExisting || hasExisting });
      onDone(r.doc, r.version);
    } catch (e) { setErr(e instanceof Error ? e.message : "Import failed."); }
    setBusy(false);
  };
  const p = preview;
  return (
    <section className="card">
      <div className="card-head"><h2>Import from V1</h2></div>
      <p className="muted small">In V1, open <b>Setup</b> and tap <b>Copy backup</b>. Paste it here. You&apos;ll see what&apos;s inside before anything is saved.</p>
      <textarea className="in" id="import-raw" rows={4} value={raw} onChange={(e) => { setRaw(e.target.value); setPreview(null); }} placeholder="Paste your V1 backup here" />
      {err && <p style={{ color: "var(--warn)" }}>{err}</p>}
      {!p && <div><button className="btn primary" disabled={!raw.trim() || busy} onClick={check}>Check backup</button></div>}
      {p && (
        <div className="stack-s">
          <p><b>This backup contains:</b> {p.areas} areas, {p.habits} daily quests, {p.days} days of check-ins ({p.checkIns} quests checked){p.from ? `, from ${p.from} to ${p.to}` : ""}, {p.missions} missions, {p.milestones} milestones, {p.reflections} weekly reflections, {p.calendarNotes} calendar notes and {p.coachMessages} coach messages.</p>
          {p.hasExisting && <p style={{ color: "var(--warn)" }}>Your V2 account already has data. Importing replaces your dashboard with this backup. Your Network and coach history stay.</p>}
          <div className="btns">
            {p.hasExisting && !confirmReplace
              ? <button className="btn danger" onClick={() => setConfirmReplace(true)}>Replace my dashboard…</button>
              : <button className="btn primary" disabled={busy} onClick={commit}>{p.hasExisting ? "Yes, replace it" : "Import"}</button>}
            <button className="btn ghost" onClick={() => { setPreview(null); setConfirmReplace(false); }}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
