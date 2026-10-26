"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtShort } from "@/lib/life/dates";
import { CARDIO_OPTIONS } from "@/lib/fitness/library";
import { fmtSession, sessionsFor } from "@/lib/fitness/history";
import { fmtW, suggest } from "@/lib/fitness/progression";
import type { Exercise, PlanSlot, SetRow, Workout } from "@/lib/fitness-db";
import { api } from "../api";
import { useFitness } from "../fitness";
import { Icon } from "../ui";

const num = (v: string) => (v.trim() === "" || isNaN(Number(v)) ? null : Number(v));

function RestTimer({ until, onDone, onAdd }: { until: number; onDone: () => void; onAdd: (s: number) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (left === 0) { try { navigator.vibrate?.(300); } catch { /* not supported */ } }
  }, [left]);
  return (
    <div className={`rest-bar${left === 0 ? " done" : ""}`} role="timer" aria-live="polite">
      <span className="num">{left ? `Rest ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Rest done. Next set."}</span>
      <button className="btn ghost sm" onClick={() => onAdd(30)}>+30s</button>
      <button className="btn ghost sm" onClick={onDone}>{left ? "Skip" : "Close"}</button>
    </div>
  );
}

function SetLine({ w, slot, n, ex, row, placeholder, needsWeight, onDone }: {
  w: Workout; slot: number; n: number; ex: string; row?: SetRow; placeholder: { weight: string; reps: string }; needsWeight: boolean; onDone: () => void;
}) {
  const { saveSet } = useFitness();
  const weightRef = useRef<HTMLInputElement>(null);
  const [weight, setWeight] = useState(row?.weight != null ? String(row.weight) : "");
  const [reps, setReps] = useState(row?.reps != null ? String(row.reps) : "");
  const done = !!row?.done;
  const save = (patch: Partial<SetRow>) => saveSet({ workoutId: w.id, slot, setNumber: n, exerciseKey: ex, weight: num(weight), reps: num(reps), done, ...patch });
  return (
    <div className={`setline${done ? " done" : ""}`}>
      <span className="num faint">{n}</span>
      <input ref={weightRef} className="in num" inputMode="decimal" aria-label={`Set ${n} weight`} placeholder={placeholder.weight} value={weight}
        onChange={(e) => { setWeight(e.target.value); if (done) saveSet({ workoutId: w.id, slot, setNumber: n, exerciseKey: ex, weight: num(e.target.value), reps: num(reps), done }); }} />
      <input className="in num" inputMode="numeric" aria-label={`Set ${n} reps`} placeholder={placeholder.reps} value={reps}
        onChange={(e) => { setReps(e.target.value); if (done) saveSet({ workoutId: w.id, slot, setNumber: n, exerciseKey: ex, weight: num(weight), reps: num(e.target.value), done }); }} />
      <button className="check" aria-pressed={done} aria-label={`Set ${n} done`} onClick={() => {
        if (done) return save({ done: false });
        // Empty boxes take the suggested weight and the bottom of the rep range, so one tap logs a set.
        const wv = weight === "" ? placeholder.weight.replace(/[^\d.]/g, "") : weight;
        const rv = reps === "" ? placeholder.reps.replace(/\D.*$/, "") : reps;
        // No weight yet and nothing to suggest (first time on this exercise): ask for it rather than log a blank.
        if (needsWeight && num(wv) === null) { weightRef.current?.focus(); weightRef.current?.classList.add("need"); return; }
        setWeight(wv); setReps(rv);
        save({ weight: num(wv), reps: num(rv), done: true });
        onDone();
      }}><Icon name="tick" /></button>
    </div>
  );
}

function ExerciseCard({ w, slot, item, ex, exercises, unit, onRest }: {
  w: Workout; slot: number; item: PlanSlot; ex?: Exercise; exercises: Exercise[]; unit: string; onRest: (sec: number) => void;
}) {
  const { data, patchWorkout } = useFitness();
  const [swapping, setSwapping] = useState(false);
  const history = useMemo(() => sessionsFor(data, item.key, w.id), [data, item.key, w.id]);
  const sug = suggest(item, history, ex?.increment ?? 5);
  const rows = data.sets.filter((s) => s.workoutId === w.id && s.slot === slot);
  const doneCount = rows.filter((s) => s.done).length;
  // Later sets default to the weight you just used; the first set defaults to the suggestion.
  const lastHere = rows.filter((r) => r.done && r.weight !== null).sort((a, b) => b.setNumber - a.setNumber)[0]?.weight ?? null;
  const base = lastHere ?? sug.weight;
  const ph = { weight: base !== null ? fmtW(base) : unit, reps: `${item.repLow}-${item.repHigh}` };
  const setPlan = (fn: (p: PlanSlot[]) => void) => { const p = structuredClone(w.plan); fn(p); patchWorkout(w.id, { plan: p }); };
  const options = exercises.filter((e) => e.key !== item.key && e.availability !== "unavailable" && e.type !== "Cardio")
    .sort((a, b) => Number(b.muscle === ex?.muscle) - Number(a.muscle === ex?.muscle) || a.name.localeCompare(b.name));

  return (
    <section className={`card ex-card${doneCount >= item.sets ? " complete" : ""}`}>
      <div className="card-head">
        <div style={{ minWidth: 0 }}>
          <h3 className="ex-name">{ex?.name ?? item.key}</h3>
          <div className="small muted">{item.sets} × {item.repLow}–{item.repHigh} · rest {Math.round(item.rest / 15) * 15}s{ex?.equipmentDetail ? ` · ${ex.equipmentDetail}` : ""}</div>
        </div>
        <button className="btn ghost sm" onClick={() => setSwapping(!swapping)}>{swapping ? "Cancel" : "Swap"}</button>
      </div>
      {item.swappedFrom && <p className="small faint">Swapped in for {exercises.find((e) => e.key === item.swappedFrom)?.name ?? "the planned exercise"} today.</p>}
      {ex?.caution && <p className="small caution">{ex.caution}</p>}
      {swapping && (
        <div className="stack-s">
          <select className="in" aria-label="Replace with" defaultValue="" onChange={(e) => {
            if (!e.target.value) return;
            setPlan((p) => { p[slot] = { ...p[slot], key: e.target.value, swappedFrom: p[slot].swappedFrom ?? item.key }; });
            setSwapping(false);
          }}>
            <option value="">Replace with…</option>
            {options.map((o) => <option key={o.key} value={o.key}>{o.name} ({o.muscle}, {o.equipment})</option>)}
          </select>
          <p className="small muted">Only changes this session. Sets you already logged stay with the exercise you did.</p>
        </div>
      )}
      <div className="small sugg">
        <div><span className="faint">Last:</span> {history[0] ? `${fmtSession(history[0], unit)} (${fmtShort(history[0].date)})` : "none yet"}</div>
        <div><span className="faint">Today:</span> {sug.weight !== null ? <b>{fmtW(sug.weight)} {unit} × {sug.reps}</b> : <b>{sug.reps} reps</b>} <span className="muted">· {sug.why}</span></div>
      </div>
      <div className="setline head small faint"><span>Set</span><span>{unit}</span><span>Reps</span><span /></div>
      {Array.from({ length: item.sets }, (_, i) => i + 1).map((n) => {
        const row = rows.find((r) => r.setNumber === n);
        return <SetLine key={`${item.key}-${n}-${row ? "r" : "n"}`} w={w} slot={slot} n={n} ex={item.key} row={row} placeholder={ph} needsWeight={(ex?.increment ?? 5) > 0}
          onDone={() => { if (n < item.sets) onRest(item.rest); }} />;
      })}
      <div className="btns">
        {item.sets < 10 && <button className="btn ghost sm" onClick={() => setPlan((p) => { p[slot].sets++; })}>+ Set</button>}
        {item.sets > 1 && <button className="btn ghost sm" onClick={() => setPlan((p) => { p[slot].sets--; })}>− Set</button>}
      </div>
    </section>
  );
}

export function CardioCard({ w }: { w: Workout }) {
  const { patchWorkout } = useFitness();
  const [mins, setMins] = useState(w.cardioMinutes != null ? String(w.cardioMinutes) : "");
  const choices = [...new Set([...w.cardioOptions, ...CARDIO_OPTIONS])];
  return (
    <section className={`card ex-card${w.cardioDone ? " complete" : ""}`}>
      <div className="card-head">
        <div><h3 className="ex-name">Cardio</h3><div className="small muted">{w.cardioMin}–{w.cardioMax} min easy, conversational pace{w.kind === "recovery" ? " · optional" : ""}</div></div>
        <button className="check" aria-pressed={w.cardioDone} aria-label="Cardio done" onClick={() => {
          const m = num(mins) ?? (w.cardioDone ? null : w.cardioMin);
          if (!w.cardioDone && mins === "") setMins(String(w.cardioMin));
          patchWorkout(w.id, { cardioDone: !w.cardioDone, cardioMinutes: m, cardioEquipment: w.cardioEquipment ?? w.cardioOptions[0] ?? null });
        }}><Icon name="tick" /></button>
      </div>
      <div className="cardio-row">
        <select className="in" aria-label="Cardio equipment" value={w.cardioEquipment ?? w.cardioOptions[0] ?? ""} onChange={(e) => patchWorkout(w.id, { cardioEquipment: e.target.value })}>
          {choices.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input className="in num" inputMode="numeric" aria-label="Cardio minutes" placeholder={`${w.cardioMin}`} value={mins}
          onChange={(e) => setMins(e.target.value)} onBlur={() => patchWorkout(w.id, { cardioMinutes: num(mins) })} />
        <span className="small muted">min</span>
      </div>
    </section>
  );
}

// Logging screen for one session. Every set saves as it's entered, so closing the app mid-workout loses nothing.
export default function WorkoutMode({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, patchWorkout, reload } = useFitness();
  const w = data.workouts.find((x) => x.id === id);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [notes, setNotes] = useState(w?.notes ?? "");
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!w?.startedAt || w.status === "completed") return;
    const tick = () => { const m = Math.floor((Date.now() - Date.parse(w.startedAt!)) / 60000); setElapsed(`${m} min`); };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [w?.startedAt, w?.status]);
  if (!w) return <section className="card"><p>That workout is gone.</p><button className="btn" onClick={onClose}>Back</button></section>;

  const exercises = data.exercises;
  const byKey = new Map(exercises.map((e) => [e.key, e]));
  const totalSets = w.plan.reduce((s, i) => s + i.sets, 0);
  const doneSets = data.sets.filter((s) => s.workoutId === w.id && s.done).length;

  return (
    <div className="workout-mode">
      <section className="hero single stack-s">
        <button className="btn ghost sm" style={{ justifySelf: "start" }} onClick={onClose}>‹ Dashboard</button>
        <span className="eyebrow">{fmtShort(w.date)}{w.status === "completed" ? " · completed" : elapsed ? ` · ${elapsed}` : ""}</span>
        <h1>{w.title.toUpperCase()}{w.focus && w.kind === "lift" ? <span className="muted"> · {w.focus}</span> : null}</h1>
        {w.kind === "lift" && <div className="small muted num">{doneSets} of {totalSets} sets logged</div>}
        {w.note && <p className="small caution">{w.note}</p>}
      </section>
      {w.plan.map((item, i) => (
        <ExerciseCard key={`${i}-${item.key}`} w={w} slot={i} item={item} ex={byKey.get(item.key)} exercises={exercises} unit={data.settings.unit}
          onRest={(sec) => { if (data.settings.restTimer) setRestUntil(Date.now() + sec * 1000); }} />
      ))}
      <CardioCard w={w} />
      <section className="card">
        <label className="lab" htmlFor="w-notes">Notes</label>
        <textarea className="in" id="w-notes" rows={2} value={notes} placeholder="How it felt, anything to change next time" onChange={(e) => setNotes(e.target.value)} onBlur={() => patchWorkout(w.id, { notes })} />
      </section>
      <div className="btns" style={{ marginBottom: 80 }}>
        {w.status !== "completed"
          ? <button className="btn primary big" onClick={async () => { await patchWorkout(w.id, { action: "finish", notes }); await reload(); onClose(); }}>Finish workout</button>
          : <button className="btn ghost" onClick={() => patchWorkout(w.id, { action: "start" })}>Reopen for editing</button>}
        <label className="toggle small"><input type="checkbox" checked={data.settings.restTimer} onChange={async (e) => { await api("/api/fitness/settings", "PATCH", { restTimer: e.target.checked }); reload(); }} />Rest timer</label>
      </div>
      {restUntil && <RestTimer until={restUntil} onDone={() => setRestUntil(null)} onAdd={(s) => setRestUntil((u) => (u ?? Date.now()) + s * 1000)} />}
    </div>
  );
}
