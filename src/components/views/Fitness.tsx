"use client";
import { useMemo, useState } from "react";
import { addDays, DOW, fmtShort, weekDays, weekOf } from "@/lib/life/dates";
import { EQUIPMENT, MUSCLES, WORKOUT_TYPES } from "@/lib/fitness/library";
import { estimateMinutes } from "@/lib/fitness/program";
import { durationMin, fmtSession, personalRecords, sessionsFor, topSets } from "@/lib/fitness/history";
import { fmtW, suggest } from "@/lib/fitness/progression";
import type { Exercise, Workout } from "@/lib/fitness-db";
import { api } from "../api";
import { useApp } from "../App";
import { FitnessProvider, useFitness } from "../fitness";
import WorkoutMode, { CardioCard } from "./WorkoutMode";

type Sub = "today" | "schedule" | "progress" | "library";
const SUBS: [Sub, string][] = [["today", "Today"], ["schedule", "Schedule"], ["progress", "Progress"], ["library", "Exercises"]];

export const STATUS_LABEL: Record<Workout["status"], string> = { planned: "Planned", in_progress: "In progress", completed: "Done", skipped: "Skipped" };
const STATUS_PILL: Record<Workout["status"], string> = { planned: "info", in_progress: "warn", completed: "good", skipped: "" };

export default function Fitness() {
  return <FitnessProvider fallback={<p className="muted" style={{ paddingTop: 24 }}>Loading your training…</p>}><FitnessInner /></FitnessProvider>;
}

function FitnessInner() {
  const [sub, setSub] = useState<Sub>("today");
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <WorkoutMode id={open} onClose={() => { setOpen(null); window.scrollTo({ top: 0 }); }} />;
  return (
    <>
      <nav className="subtabs" aria-label="Fitness sections">
        {SUBS.map(([k, label]) => <button key={k} aria-current={sub === k ? "page" : undefined} onClick={() => setSub(k)}>{label}</button>)}
      </nav>
      {sub === "today" && <Home onOpen={setOpen} />}
      {sub === "schedule" && <Schedule onOpen={setOpen} />}
      {sub === "progress" && <Progress />}
      {sub === "library" && <Library />}
    </>
  );
}

function StatusPill({ w }: { w: Workout }) {
  return <span className={`pill ${STATUS_PILL[w.status]}`}>{STATUS_LABEL[w.status].toUpperCase()}</span>;
}

function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const { today } = useApp();
  const { data, patchWorkout } = useFitness();
  const unit = data.settings.unit;
  const byKey = new Map(data.exercises.map((e) => [e.key, e]));
  const todays = data.workouts.filter((w) => w.date === today);
  const w = todays.find((x) => x.status === "in_progress") ?? todays.find((x) => x.kind === "lift") ?? todays[0];
  const wk = weekOf(today);
  const week = data.workouts.filter((x) => x.date >= wk && x.date <= addDays(wk, 6));
  const lifts = week.filter((x) => x.kind === "lift");
  const upcoming = data.workouts.filter((x) => x.date > today && x.status === "planned").slice(0, 6);
  const cardioWeek = week.reduce((m, x) => m + (x.cardioDone ? x.cardioMinutes ?? 0 : 0), 0);
  // What's already logged today for this slot, if anything.
  const todayLine = (slot: number, key: string) => {
    if (!w) return null;
    const sets = data.sets.filter((x) => x.workoutId === w.id && x.slot === slot && x.exerciseKey === key && x.done).sort((a, b) => a.setNumber - b.setNumber);
    return sets.length ? `Today: ${fmtSession({ date: w.date, sets }, unit)}` : null;
  };

  return (
    <>
      {!w && <section className="card"><h2>Nothing scheduled today</h2><p className="small muted">Your program runs Oct 25 to Nov 30. Moved or extra sessions show up in Schedule.</p></section>}
      {w && w.kind === "recovery" && (
        <>
          <section className="hero single stack-s">
            <span className="eyebrow">Today · {fmtShort(today)}</span>
            <h1>RECOVERY DAY</h1>
            <p className="muted">No lifting. An easy 20 to 30 minute walk or ride helps you recover; skip it if you&apos;re worn down.</p>
          </section>
          <CardioCard w={w} />
        </>
      )}
      {w && w.kind === "lift" && (
        <section className="card today-workout">
          <div className="card-head"><span className="eyebrow">Today · {fmtShort(today)}</span><StatusPill w={w} /></div>
          <h1 className="workout-title">{w.title.toUpperCase()} <span className="muted">· {w.focus.toUpperCase()}</span></h1>
          <div className="small muted">About {estimateMinutes(w.plan, w.cardioMax)} min · {w.plan.reduce((s, i) => s + i.sets, 0)} working sets · cardio {w.cardioMin}–{w.cardioMax} min ({w.cardioOptions.join(" or ").toLowerCase()})</div>
          {w.note && <p className="small caution">{w.note}</p>}
          <div className="list" style={{ marginTop: 10 }}>
            {w.plan.map((item, i) => {
              const ex = byKey.get(item.key);
              const hist = sessionsFor(data, item.key, w.id);
              const s = suggest(item, hist, ex?.increment ?? 5);
              return (
                <div className="row plan-row" key={i}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="quest-name">{ex?.name ?? item.key}</div>
                    <div className="small muted">{todayLine(i, item.key) ?? (hist[0] ? `Last: ${fmtSession(hist[0], unit)}${s.weight !== null ? ` · Next: ${fmtW(s.weight)} ${unit}` : ""}` : "No history yet")}</div>
                  </div>
                  <span className="num small">{item.sets} × {item.repLow}–{item.repHigh}</span>
                </div>
              );
            })}
          </div>
          <div className="btns" style={{ marginTop: 12 }}>
            {w.status === "completed"
              ? <button className="btn big" onClick={() => onOpen(w.id)}>View or edit workout</button>
              : <button className="btn primary big" onClick={async () => { if (w.status !== "in_progress") await patchWorkout(w.id, { action: "start" }); onOpen(w.id); }}>
                  {w.status === "in_progress" ? "Resume workout" : "Start workout"}</button>}
            {w.status === "planned" && <button className="btn ghost" onClick={() => patchWorkout(w.id, { action: "skip" })}>Skip today</button>}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>This week</h2><span className="small muted num">{lifts.filter((x) => x.status === "completed").length} of {lifts.length} lifts · {cardioWeek} cardio min</span></div>
        <div className="weekstrip">
          {weekDays(wk).map((d, i) => {
            const x = week.find((y) => y.date === d);
            return (
              <button key={d} className={`wday${d === today ? " today" : ""} ${x?.status ?? ""}`} onClick={() => x && onOpen(x.id)} disabled={!x}>
                <span className="small faint">{DOW[i]}</span>
                <b className="small">{x ? (x.kind === "recovery" ? "Rest" : x.title.split(" ")[0]) : "—"}</b>
                <span className="small faint">{x && x.kind === "lift" ? x.title.split(" ")[1] : "\u00a0"}</span>
                <span className={`dotmark ${x?.status ?? ""}`} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Coming up</h2></div>
        {upcoming.length ? upcoming.map((x) => (
          <div className="row" key={x.id}>
            <span className="num small faint" style={{ width: 72 }}>{DOW[(new Date(x.date + "T12:00").getDay() + 6) % 7]} {fmtShort(x.date)}</span>
            <span className="grow"><b>{x.title}</b> <span className="small muted">{x.kind === "lift" ? x.focus : "light cardio"}</span></span>
          </div>
        )) : <p className="small muted">Nothing else planned.</p>}
      </section>
    </>
  );
}

function Schedule({ onOpen }: { onOpen: (id: string) => void }) {
  const { today } = useApp();
  const { data, patchWorkout } = useFitness();
  const [moving, setMoving] = useState<string | null>(null);
  const weeks = useMemo(() => {
    const m = new Map<string, Workout[]>();
    for (const w of data.workouts) (m.get(weekOf(w.date)) ?? m.set(weekOf(w.date), []).get(weekOf(w.date))!).push(w);
    return [...m.entries()];
  }, [data.workouts]);
  return (
    <>
      <p className="small muted" style={{ marginTop: 4 }}>Move a session to another day, skip it, or open any past one to edit what you logged. Moving never changes what you&apos;ve already recorded.</p>
      {weeks.map(([wk, list]) => (
        <section className="card" key={wk}>
          <div className="card-head"><h2>Week of {fmtShort(wk)}</h2><span className="small muted num">{list.filter((x) => x.kind === "lift" && x.status === "completed").length}/{list.filter((x) => x.kind === "lift").length} lifts</span></div>
          {list.map((w) => (
            <div key={w.id} className={`row sched${w.date === today ? " is-today" : ""}`} style={{ flexWrap: "wrap" }}>
              <span className="num small faint" style={{ width: 72 }}>{DOW[(new Date(w.date + "T12:00").getDay() + 6) % 7]} {fmtShort(w.date)}</span>
              <button className="grow linkish" onClick={() => onOpen(w.id)}>
                <b>{w.title}</b> <span className="small muted">{w.kind === "lift" ? w.focus : "light cardio"}{w.originalDate && w.originalDate !== w.date ? ` · moved from ${fmtShort(w.originalDate)}` : ""}</span>
              </button>
              <StatusPill w={w} />
              {moving === w.id ? (
                <span style={{ display: "flex", gap: 6 }}>
                  <input className="in" type="date" aria-label="New date" defaultValue={w.date} onChange={(e) => { if (e.target.value) { patchWorkout(w.id, { date: e.target.value }); setMoving(null); } }} />
                  <button className="btn ghost sm" onClick={() => setMoving(null)}>Cancel</button>
                </span>
              ) : (
                <span style={{ display: "flex", gap: 6 }}>
                  <button className="btn ghost sm" onClick={() => setMoving(w.id)}>Move</button>
                  {w.status === "planned" && <button className="btn ghost sm" onClick={() => patchWorkout(w.id, { action: "skip" })}>Skip</button>}
                  {w.status === "skipped" && <button className="btn ghost sm" onClick={() => patchWorkout(w.id, { action: "reopen" })}>Unskip</button>}
                </span>
              )}
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

function LineChart({ points, unit }: { points: { date: string; v: number; label: string }[]; unit: string }) {
  if (points.length < 2) return <p className="small muted">{points.length ? `One session so far: ${points[0].label}. The chart starts after your second.` : "No sessions logged yet."}</p>;
  const W = 320, H = 140, L = 34, R = 10, T = 12, B = 22;
  const vs = points.map((p) => p.v), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const x = (i: number) => L + (i * (W - L - R)) / (points.length - 1);
  const y = (v: number) => T + (1 - (v - lo) / span) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Top set over time, ${points.length} sessions`}>
      {[lo, hi].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill="var(--faint)" fontFamily="var(--mono)">{fmtW(v)}</text></g>)}
      <polyline fill="none" stroke="var(--gold)" strokeWidth={2} points={points.map((p, i) => `${x(i)},${y(p.v)}`).join(" ")} />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r={3} fill="var(--gold)"><title>{`${fmtShort(p.date)}: ${p.label}`}</title></circle>)}
      <text x={L} y={H - 6} fontSize={9} fill="var(--faint)" fontFamily="var(--mono)">{fmtShort(points[0].date)}</text>
      <text x={W - R} y={H - 6} textAnchor="end" fontSize={9} fill="var(--faint)" fontFamily="var(--mono)">{fmtShort(points.at(-1)!.date)} · {unit}</text>
    </svg>
  );
}

function Progress() {
  const { today } = useApp();
  const { data, reload } = useFitness();
  const unit = data.settings.unit;
  const name = (k: string) => data.exercises.find((e) => e.key === k)?.name ?? k;
  const done = data.workouts.filter((w) => w.status === "completed");
  const pastLifts = data.workouts.filter((w) => w.kind === "lift" && w.date <= today);
  const doneLifts = pastLifts.filter((w) => w.status === "completed");
  const cardioTotal = data.workouts.reduce((m, w) => m + (w.cardioDone ? w.cardioMinutes ?? 0 : 0), 0);
  const durations = done.map(durationMin).filter((x): x is number => x !== null);
  const doneSets = data.sets.filter((s) => s.done);
  const logged = [...new Set(doneSets.map((s) => s.exerciseKey))];
  const [pick, setPick] = useState(logged[0] ?? "");
  const prs = personalRecords(data);
  const [bw, setBw] = useState("");

  return (
    <>
      <section className="card">
        <h2>Training so far</h2>
        <div className="stats">
          <div><b className="num">{doneLifts.length}/{pastLifts.length}</b><span className="small muted">lifting sessions done (to date)</span></div>
          <div><b className="num">{doneSets.length}</b><span className="small muted">sets · {doneSets.reduce((r, s) => r + (s.reps ?? 0), 0)} reps</span></div>
          <div><b className="num">{cardioTotal}</b><span className="small muted">cardio minutes</span></div>
          <div><b className="num">{durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : "–"}</b><span className="small muted">avg minutes per workout</span></div>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Strength by exercise</h2></div>
        {logged.length ? (
          <>
            <select className="in" aria-label="Exercise" value={pick} onChange={(e) => setPick(e.target.value)}>{logged.map((k) => <option key={k} value={k}>{name(k)}</option>)}</select>
            <div className="chart"><LineChart unit={unit} points={topSets(data, pick).map((p) => ({ date: p.date, v: p.weight, label: `${fmtW(p.weight)} ${unit} × ${p.reps}` }))} /></div>
            <p className="small muted">Heaviest completed set each session.</p>
          </>
        ) : <p className="small muted">Finish your first workout and your lifts will chart here.</p>}
      </section>

      <section className="card">
        <h2>Personal records</h2>
        {prs.length ? prs.map((p) => (
          <div className="row" key={p.key}><span className="grow">{name(p.key)}</span><span className="num small">{fmtW(p.weight)} {unit} × {p.reps}</span><span className="small faint">{fmtShort(p.date)}</span></div>
        )) : <p className="small muted">Records appear once you&apos;ve logged sets.</p>}
        <p className="small faint">Best set by estimated one-rep max, so heavier low-rep sets and lighter high-rep sets compare fairly.</p>
      </section>

      <section className="card">
        <div className="card-head"><h2>Body weight</h2><span className="small muted">Optional</span></div>
        <form style={{ display: "flex", gap: 8 }} onSubmit={async (e) => { e.preventDefault(); const v = Number(bw); if (!v) return; await api("/api/fitness/body-weight", "POST", { date: today, weight: v }); setBw(""); reload(); }}>
          <input className="in num" inputMode="decimal" aria-label="Body weight today" placeholder={`Today's weight (${unit})`} value={bw} onChange={(e) => setBw(e.target.value)} />
          <button className="btn" type="submit">Save</button>
        </form>
        <div className="chart"><LineChart unit={unit} points={data.bodyWeights.map((b) => ({ date: b.date, v: b.weight, label: `${fmtW(b.weight)} ${unit}` }))} /></div>
      </section>
    </>
  );
}

function ExerciseRow({ e }: { e: Exercise }) {
  const { reload } = useFitness();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: e.name, equipmentDetail: e.equipmentDetail, increment: String(e.increment) });
  const save = async (patch: Record<string, unknown>) => { await api(`/api/fitness/exercises/${e.key}`, "PATCH", patch); reload(); };
  return (
    <div className="lib-row">
      <button className="linkish row" style={{ width: "100%" }} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="grow" style={{ textAlign: "left" }}><b>{e.name}</b><br /><span className="small muted">{e.equipment}{e.equipmentDetail ? ` · ${e.equipmentDetail}` : ""} · {e.pattern}</span></span>
        {e.availability === "available" && <span className="pill good">HAVE IT</span>}
        {e.availability === "unavailable" && <span className="pill">NOT AT MY GYM</span>}
      </button>
      {open && (
        <div className="stack-s" style={{ padding: "0 4px 12px" }}>
          {e.caution && <p className="small caution">{e.caution}</p>}
          <div className="field"><label className="lab" htmlFor={`n-${e.key}`}>Name</label><input className="in" id={`n-${e.key}`} value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} onBlur={() => f.name.trim() && f.name !== e.name && save({ name: f.name.trim() })} /></div>
          <div className="field"><label className="lab" htmlFor={`d-${e.key}`}>Exact machine at your gym</label><input className="in" id={`d-${e.key}`} placeholder="e.g. Technogym Selection, station by the windows" value={f.equipmentDetail} onChange={(x) => setF({ ...f, equipmentDetail: x.target.value })} onBlur={() => f.equipmentDetail !== e.equipmentDetail && save({ equipmentDetail: f.equipmentDetail })} /></div>
          <div className="field"><label className="lab" htmlFor={`i-${e.key}`}>Smallest weight jump</label><input className="in num" id={`i-${e.key}`} inputMode="decimal" value={f.increment} onChange={(x) => setF({ ...f, increment: x.target.value })} onBlur={() => Number(f.increment) !== e.increment && save({ increment: Number(f.increment) || 0 })} /></div>
          <div className="btns">
            <button className="btn sm" aria-pressed={e.availability === "available"} onClick={() => save({ availability: "available" })}>My gym has it</button>
            <button className="btn sm" aria-pressed={e.availability === "unavailable"} onClick={() => save({ availability: "unavailable" })}>Not at my gym</button>
            {e.availability !== "unknown" && <button className="btn ghost sm" onClick={() => save({ availability: "unknown" })}>Not sure</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function Library() {
  const { data, reload } = useFitness();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equip, setEquip] = useState("");
  const [type, setType] = useState("");
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ name: "", muscle: "Chest", equipment: "Technogym machine", type: "Push", equipmentDetail: "" });
  const list = data.exercises.filter((e) => (!q || e.name.toLowerCase().includes(q.toLowerCase())) && (!muscle || e.muscle === muscle) && (!equip || e.equipment === equip) && (!type || e.type === type));
  const groups = MUSCLES.map((m) => [m, list.filter((e) => e.muscle === m)] as const).filter(([, l]) => l.length);
  return (
    <>
      <section className="card stack-s">
        <p className="small muted">Machine names are generic: your gym may have a different model or none at all. Open an exercise to record the exact machine and mark whether your gym has it. Exercises marked &quot;not at my gym&quot; won&apos;t be offered as swaps.</p>
        <input className="in" aria-label="Search exercises" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="filters">
          <select className="in" aria-label="Muscle group" value={muscle} onChange={(e) => setMuscle(e.target.value)}><option value="">All muscles</option>{MUSCLES.map((m) => <option key={m}>{m}</option>)}</select>
          <select className="in" aria-label="Equipment" value={equip} onChange={(e) => setEquip(e.target.value)}><option value="">All equipment</option>{EQUIPMENT.map((m) => <option key={m}>{m}</option>)}</select>
          <select className="in" aria-label="Workout type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{WORKOUT_TYPES.map((m) => <option key={m}>{m}</option>)}</select>
        </div>
        {!adding ? <button className="btn sm" style={{ justifySelf: "start" }} onClick={() => setAdding(true)}>+ Custom exercise</button> : (
          <form className="stack-s" onSubmit={async (e) => {
            e.preventDefault(); if (!nf.name.trim()) return;
            await api("/api/fitness/exercises", "POST", { ...nf, pattern: "", increment: nf.equipment === "Bodyweight" ? 0 : 5 });
            setNf({ ...nf, name: "", equipmentDetail: "" }); setAdding(false); reload();
          }}>
            <input className="in" aria-label="Exercise name" placeholder="Exercise name" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} />
            <div className="filters">
              <select className="in" aria-label="Muscle group" value={nf.muscle} onChange={(e) => setNf({ ...nf, muscle: e.target.value })}>{MUSCLES.map((m) => <option key={m}>{m}</option>)}</select>
              <select className="in" aria-label="Equipment" value={nf.equipment} onChange={(e) => setNf({ ...nf, equipment: e.target.value })}>{EQUIPMENT.map((m) => <option key={m}>{m}</option>)}</select>
              <select className="in" aria-label="Workout type" value={nf.type} onChange={(e) => setNf({ ...nf, type: e.target.value })}>{WORKOUT_TYPES.map((m) => <option key={m}>{m}</option>)}</select>
            </div>
            <input className="in" aria-label="Exact machine" placeholder="Exact machine (optional)" value={nf.equipmentDetail} onChange={(e) => setNf({ ...nf, equipmentDetail: e.target.value })} />
            <div className="btns"><button className="btn primary sm" type="submit">Add exercise</button><button className="btn ghost sm" type="button" onClick={() => setAdding(false)}>Cancel</button></div>
          </form>
        )}
      </section>
      {groups.map(([m, l]) => (
        <section className="card" key={m}>
          <h2>{m}</h2>
          {l.map((e) => <ExerciseRow key={e.key} e={e} />)}
        </section>
      ))}
      {!groups.length && <p className="muted">No exercises match.</p>}
    </>
  );
}
